import type { QueueItem } from "../types/queue";
import { GraphNodeType, type GraphNode, type GraphEdge } from "../components/graph/KnowledgeGraph";
import { type FeedItem } from "../api/rss";

// Set of common English stop words to filter out during tokenization
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "arent",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "cant",
  "cannot", "could", "couldnt", "did", "didnt", "do", "does", "doesnt", "doing", "dont", "down", "during",
  "each", "few", "for", "from", "further", "had", "hadnt", "has", "hasnt", "have", "havent", "having",
  "he", "hed", "hell", "hes", "her", "here", "heres", "hers", "herself", "him", "himself", "his", "how",
  "hows", "i", "id", "ill", "im", "ive", "if", "in", "into", "is", "isnt", "it", "its", "itself",
  "lets", "me", "more", "most", "mustnt", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
  "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shant",
  "she", "shed", "shell", "shes", "should", "shouldnt", "so", "some", "such", "than", "that", "thats",
  "the", "their", "theirs", "them", "themselves", "then", "there", "theres", "these", "they", "theyd",
  "theyll", "theyre", "theyve", "this", "those", "through", "to", "too", "under", "until", "up", "very",
  "was", "wasnt", "we", "wed", "well", "were", "weve", "werent", "what", "whats", "when", "whens",
  "where", "wheres", "which", "while", "who", "whos", "whom", "why", "whys", "with", "wont", "would",
  "wouldnt", "you", "youd", "youll", "youre", "youve", "your", "yours", "yourself", "yourselves",
  "the", "this", "that", "with", "from", "have", "been", "were", "will", "would", "should", "could"
]);

// (TCS_LEXICON removed — replaced by embedding-based similarity)

/**
 * Tokenizes, lowercases, cleans and filters stop words from a text string.
 */
export function tokenize(text: string): Set<string> {
  if (!text) return new Set();
  
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // remove punctuation except dashes
    .split(/[\s_]+/) // split by spaces or underscores
    .map(token => token.trim())
    .filter(token => token.length >= 3 && !STOP_WORDS.has(token));
    
  return new Set(tokens);
}

/**
 * Calculates Jaccard similarity coefficient between two sets of strings.
 * Score is in range [0, 1].
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  
  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionSize++;
    }
  }
  
  const unionSize = setA.size + setB.size - intersectionSize;
  return intersectionSize / unionSize;
}

/**
 * Returns a score [0, 1] indicating how closely an item matches a search/focal topic
 */
export function scoreFocalTopic(item: QueueItem, topic: string): number {
  const normalizedTopic = topic.toLowerCase().trim();
  if (!normalizedTopic) return 1.0;

  const itemText = [
    item.documentTitle,
    item.category,
    item.question,
    item.clozeText,
    item.answer,
    ...(item.tags || [])
  ].filter(Boolean).join(" ").toLowerCase();

  // 1. Direct substring match
  if (itemText.includes(normalizedTopic)) {
    return 1.0;
  }

  // 2. Generic token overlap
  const topicTokens = tokenize(normalizedTopic);
  const itemTokens = tokenize(itemText);

  let intersection = 0;
  for (const token of topicTokens) {
    if (itemTokens.has(token) || itemText.includes(token)) {
      intersection++;
    }
  }

  return topicTokens.size > 0 ? intersection / topicTokens.size : 0;
}

/**
 * Computes semantic similarity score [0, 1] between two queue items.
 */
export function calculateItemSimilarity(itemA: QueueItem, itemB: QueueItem): number {
  if (itemA.id === itemB.id) return 1.0;
  
  // Create text packages for comparison
  const textA = [itemA.documentTitle, itemA.question, itemA.clozeText, itemA.category].filter(Boolean).join(" ");
  const textB = [itemB.documentTitle, itemB.question, itemB.clozeText, itemB.category].filter(Boolean).join(" ");
  
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  
  // Base text similarity (Jaccard)
  const textSim = jaccardSimilarity(tokensA, tokensB);
  
  // Tag similarity
  const tagsA = new Set((itemA.tags || []).map(t => t.toLowerCase()));
  const tagsB = new Set((itemB.tags || []).map(t => t.toLowerCase()));
  const tagSim = jaccardSimilarity(tagsA, tagsB);
  
  // Category similarity boost
  const categorySim = (itemA.category && itemB.category && itemA.category.toLowerCase() === itemB.category.toLowerCase()) ? 0.35 : 0.0;
  
  // Document match boost (if they belong to the same document, they are highly related)
  const docSim = (itemA.documentId && itemB.documentId && itemA.documentId === itemB.documentId) ? 0.25 : 0.0;
  
  // Weighted aggregate
  let score = (textSim * 0.45) + (tagSim * 0.3) + categorySim + docSim;

  return Math.min(1.0, score);
}

/**
 * Generates visual GraphNode and GraphEdge data from a list of QueueItems.
 * Throttles or filters based on a similarity threshold (0 to 100).
 */
export function buildSemanticGraph(
  items: QueueItem[],
  thresholdPercent: number,
  focalTopic?: string,
  rssItems?: FeedItem[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const threshold = thresholdPercent / 100;

  // Map RSS items to pseudo QueueItems
  const rssQueueItems: QueueItem[] = (rssItems || []).map(item => {
    return {
      id: item.id.startsWith("rss-") ? item.id : `rss-${item.id}`,
      documentId: item.id.startsWith("rss-") ? item.id : `rss-${item.id}`,
      documentTitle: item.title || "Untitled",
      itemType: "rss-article",
      priority: 5,
      estimatedTime: 5,
      tags: item.categories || [],
      category: item.categories?.[0] ?? "rss",
      progress: 0,
      // Store original RSS properties in custom fields for detail panel retrieval
      rssItem: item,
      rssFeed: { id: item.feedId, title: "RSS Feed", link: item.link },
    } as any;
  });

  const allItems = [...items, ...rssQueueItems];
  
  // 1. Filter and score nodes if focal topic is provided
  const scoredItems = allItems.map(item => {
    const topicScore = focalTopic ? scoreFocalTopic(item, focalTopic) : 1.0;
    return { item, topicScore };
  });
  
  // If focal topic is provided, filter out items that don't match it
  const activeItems = focalTopic 
    ? scoredItems.filter(si => si.topicScore > 0.0).map(si => si.item)
    : allItems;
    
  // Cap at 250 items to prevent O(N^2) computational overhead and keep graph rendering responsive
  const cappedItems = activeItems.slice(0, 250);
    
  const nodes: GraphNode[] = cappedItems.map((item, idx) => {
    let nodeType = GraphNodeType.Document;
    let nodeColor = "#3b82f6"; // blue (document)
    
    if (item.itemType === "learning-item") {
      nodeType = GraphNodeType.Flashcard;
      nodeColor = "#a855f7"; // purple
    } else if (item.itemType === "extract") {
      nodeType = GraphNodeType.Extract;
      nodeColor = "#22c55e"; // green
    } else if (item.itemType === "rss-article") {
      nodeType = GraphNodeType.Rss;
      nodeColor = "#ea580c"; // orange (RSS)
    }
    
    // Choose label
    let label = item.documentTitle || "Untitled";
    if (item.itemType === "learning-item" && item.question) {
      label = item.question.length > 35 ? item.question.substring(0, 32) + "..." : item.question;
    } else if (item.itemType === "extract" && item.clozeText) {
      label = item.clozeText.length > 35 ? item.clozeText.substring(0, 32) + "..." : item.clozeText;
    }
    
    // Spread nodes out around a center
    const angle = (idx / cappedItems.length) * Math.PI * 2;
    const distance = 150 + Math.random() * 200;
    const x = 400 + Math.cos(angle) * distance;
    const y = 300 + Math.sin(angle) * distance;
    
    return {
      id: item.id,
      type: nodeType,
      label,
      description: item.question || item.clozeText || item.documentTitle,
      x,
      y,
      radius: nodeType === GraphNodeType.Document ? 22 : nodeType === GraphNodeType.Extract ? 16 : 12,
      color: nodeColor,
      category: item.category,
      tags: item.tags,
      metadata: { 
        documentId: item.documentId, 
        priority: item.priority,
        estimatedTime: item.estimatedTime,
        originalItem: item
      }
    };
  });
  
  // 2. Build pairwise edges based on similarity above threshold
  const edges: GraphEdge[] = [];
  let edgeIdCounter = 1;
  
  for (let i = 0; i < cappedItems.length; i++) {
    for (let j = i + 1; j < cappedItems.length; j++) {
      const itemA = cappedItems[i];
      const itemB = cappedItems[j];
      
      const similarity = calculateItemSimilarity(itemA, itemB);
      
      if (similarity >= threshold && similarity > 0.05) {
        edges.push({
          id: `sem-edge-${edgeIdCounter++}`,
          source: itemA.id,
          target: itemB.id,
          type: "related",
          weight: similarity,
          label: `${Math.round(similarity * 100)}%`
        });
      }
    }
  }
  
  return { nodes, edges };
}
