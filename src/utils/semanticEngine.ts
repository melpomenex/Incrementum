import { invoke } from "@tauri-apps/api/core";
import { buildSemanticGraph as lexicalBuildSemanticGraph } from "./semanticRelations";
import { GraphNodeType, type GraphNode, type GraphEdge } from "../components/graph/KnowledgeGraph";
import type { QueueItem } from "../types/queue";
import { type FeedItem, getSubscribedFeeds } from "../api/rss";

export interface EmbeddingConfigInput {
  provider: "OpenAI" | "Cohere" | "OpenRouter" | "Ollama";
  openaiApiKey?: string;
  openaiModel?: string;
  cohereApiKey?: string;
  cohereModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

interface QueueItemSummary {
  id: string;
  title: string;
  textContent: string;
  tags: string[];
}

interface GraphNodeOutput {
  id: string;
  type: string;
  label: string;
  description?: string;
  x: number;
  y: number;
  radius?: number;
  color?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface GraphEdgeOutput {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  label: string;
}

interface SemanticGraphResult {
  nodes: GraphNodeOutput[];
  edges: GraphEdgeOutput[];
  usedEmbeddings: boolean;
}

function queueItemToSummary(item: QueueItem): QueueItemSummary {
  const textParts = [
    item.question,
    item.clozeText,
    item.answer,
    item.category,
  ].filter(Boolean);
  return {
    id: item.id,
    title: item.documentTitle || "Untitled",
    textContent: textParts.join(". "),
    tags: item.tags || [],
  };
}

function rssItemToSummary(item: FeedItem): QueueItemSummary {
  const textParts = [
    item.description || "",
    item.content || "",
  ].filter(Boolean);
  return {
    id: item.id.startsWith("rss-") ? item.id : `rss-${item.id}`,
    title: item.title || "Untitled",
    textContent: textParts.join(". "),
    tags: item.categories || [],
  };
}

function parseNodeType(typeStr: string): GraphNodeType {
  switch (typeStr) {
    case "Document": return GraphNodeType.Document;
    case "Extract": return GraphNodeType.Extract;
    case "Flashcard": return GraphNodeType.Flashcard;
    case "Rss":
    case "RssArticle":
      return GraphNodeType.Rss;
    default: return GraphNodeType.Document;
  }
}

function convertBackendResult(
  result: SemanticGraphResult,
  items: QueueItem[],
  rssItems: FeedItem[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const itemMap = new Map(items.map((i) => [i.id, i]));
  
  // Cache subscribed feeds to construct the mock feed objects in metadata
  const feeds = getSubscribedFeeds();
  const rssMap = new Map(rssItems.map((r) => [r.id.startsWith("rss-") ? r.id : `rss-${r.id}`, r]));

  const nodes: GraphNode[] = result.nodes.map((n) => {
    const isRss = n.id.startsWith("rss-");
    if (isRss) {
      const originalRss = rssMap.get(n.id);
      const feed = originalRss ? feeds.find(f => f.id === originalRss.feedId) : undefined;
      return {
        id: n.id,
        type: GraphNodeType.Rss,
        label: n.label,
        description: n.description,
        x: n.x,
        y: n.y,
        radius: n.radius,
        color: n.color || "#ea580c",
        category: n.category ?? "RSS",
        tags: n.tags ?? originalRss?.categories ?? [],
        metadata: {
          originalItem: originalRss ? {
            id: n.id,
            documentId: n.id,
            documentTitle: originalRss.title,
            itemType: "rss-article",
            tags: originalRss.categories || [],
            estimatedTime: 5,
            progress: 0,
            rssItem: originalRss,
            rssFeed: feed || { id: originalRss.feedId, title: "RSS Feed", link: originalRss.link },
          } : undefined,
        },
      };
    }

    const originalItem = itemMap.get(n.id);
    return {
      id: n.id,
      type: parseNodeType(n.type),
      label: n.label,
      description: n.description,
      x: n.x,
      y: n.y,
      radius: n.radius,
      color: n.color,
      category: n.category ?? originalItem?.category,
      tags: n.tags ?? originalItem?.tags,
      metadata: {
        documentId: originalItem?.documentId,
        priority: originalItem?.priority,
        estimatedTime: originalItem?.estimatedTime,
        originalItem,
      },
    };
  });

  const edges: GraphEdge[] = result.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type as GraphEdge["type"],
    weight: e.weight,
    label: e.label,
  }));

  return { nodes, edges };
}

export type EmbeddingStatus = "idle" | "embedding" | "done" | "error";

/**
 * Build the semantic graph using embeddings when available, falling back to lexical similarity.
 */
export async function buildSemanticGraph(
  items: QueueItem[],
  thresholdPercent: number,
  focalTopic?: string,
  embeddingConfig?: EmbeddingConfigInput,
  onEmbeddingStatus?: (status: EmbeddingStatus) => void,
  rssItems?: FeedItem[],
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  // Try embedding-based graph if config is provided
  if (embeddingConfig) {
    try {
      const summaries = items.map(queueItemToSummary);
      const rssSummaries = rssItems ? rssItems.map(rssItemToSummary) : [];

      const result = await invoke<SemanticGraphResult>("compute_semantic_graph", {
        items: summaries,
        rssItems: rssSummaries,
        thresholdPercent,
        config: embeddingConfig,
      });

      if (result.usedEmbeddings && result.nodes.length > 0) {
        return convertBackendResult(result, items, rssItems || []);
      }

      // No embeddings yet — trigger background embedding and fall back to lexical
      onEmbeddingStatus?.("embedding");

      const embeddedCount = await invoke<number>("embed_queue_items", {
        items: summaries,
        config: embeddingConfig,
      });

      let embeddedRssCount = 0;
      if (rssSummaries.length > 0) {
        embeddedRssCount = await invoke<number>("embed_active_rss_articles", {
          items: rssSummaries,
          config: embeddingConfig,
        });
      }

      if (embeddedCount > 0 || embeddedRssCount > 0) {
        // Re-fetch the graph now that embeddings exist
        const result2 = await invoke<SemanticGraphResult>("compute_semantic_graph", {
          items: summaries,
          rssItems: rssSummaries,
          thresholdPercent,
          config: embeddingConfig,
        });

        if (result2.nodes.length > 0) {
          onEmbeddingStatus?.("done");
          return convertBackendResult(result2, items, rssItems || []);
        }
      }

      onEmbeddingStatus?.("done");
    } catch (e) {
      console.warn("Embedding-based graph failed, falling back to lexical:", e);
      onEmbeddingStatus?.("error");
    }
  }

  // Lexical fallback
  return lexicalBuildSemanticGraph(items, thresholdPercent, focalTopic, rssItems);
}

export { type EmbeddingConfigInput as EmbeddingConfig };
