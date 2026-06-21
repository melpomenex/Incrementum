/**
 * Whole-library RAG (retrieval-augmented generation) chat API.
 *
 * Wraps the backend rag_* commands. The embedding config is built from the
 * user's persisted embedding settings (provider/model/chunk-size/top-k) plus
 * the relevant API key resolved from the AI key store.
 */

import { invokeCommand, listen, type UnlistenFn } from "../lib/tauri";
import type { EmbeddingSettings } from "../types/settings";
import type { LLMMessage } from "./llm";

/** Maps to `EmbeddingConfigInput` on the backend. */
export interface EmbeddingConfig {
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

export interface RagOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  minSimilarity?: number;
}

export interface RagHit {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  chunkText: string;
  score: number;
}

export interface RagIndexStatus {
  indexedDocuments: number;
  totalDocuments: number;
  totalChunks: number;
  provider: string;
  model: string;
  /** Non-archived documents with no extractable text content (can't be indexed). */
  documentsWithoutContent: number;
}

export interface RagChatResponse {
  answer: string;
  citations: RagHit[];
}

export interface RagIndexProgress {
  current: number;
  total: number;
  documentId: string;
  documentTitle: string;
  chunksEmbedded: number;
}

/**
 * Build an `EmbeddingConfig` from the user's persisted embedding settings plus
 * a resolved API key. Falls back to whatever the settings specify; cloud
 * providers without a key will surface a backend error at call time.
 */
export function buildEmbeddingConfig(
  settings: EmbeddingSettings,
  keys: { openai?: string; cohere?: string; openrouter?: string } = {}
): EmbeddingConfig {
  const providerMap = {
    openai: "OpenAI",
    cohere: "Cohere",
    openrouter: "OpenRouter",
    ollama: "Ollama",
  } as const;

  return {
    provider: providerMap[settings.provider],
    openaiApiKey: keys.openai,
    openaiModel: settings.openaiModel,
    cohereApiKey: keys.cohere,
    cohereModel: settings.cohereModel,
    openrouterApiKey: keys.openrouter,
    openrouterModel: settings.openrouterModel,
    ollamaBaseUrl: settings.ollamaBaseUrl,
    ollamaModel: settings.ollamaModel,
  };
}

/** Convert embedding settings to the per-call `RagOptions`. */
export function buildRagOptions(settings: EmbeddingSettings): RagOptions {
  return {
    chunkSize: settings.chunkSize,
    chunkOverlap: settings.chunkOverlap,
    topK: settings.topK,
    minSimilarity: settings.minSimilarity,
  };
}

/** Chunk + embed a single document. Returns the number of chunks embedded. */
export async function ragIndexDocument(
  documentId: string,
  config: EmbeddingConfig,
  options?: RagOptions
): Promise<number> {
  return await invokeCommand<number>("rag_index_document", {
    documentId,
    document_id: documentId,
    config,
    options: options ?? null,
  });
}

/** Index every document in the active collection. */
export async function ragIndexCollection(
  config: EmbeddingConfig,
  options?: RagOptions,
  collectionId?: string
): Promise<number> {
  return await invokeCommand<number>("rag_index_collection", {
    config,
    options: options ?? null,
    collectionId: collectionId ?? null,
    collection_id: collectionId ?? null,
  });
}

/** Report RAG index status for the configured provider+model. */
export async function ragIndexStatus(config: EmbeddingConfig): Promise<RagIndexStatus> {
  return await invokeCommand<RagIndexStatus>("rag_index_status", { config });
}

/** Top-k semantic search over document chunks. */
export async function ragSearch(
  query: string,
  config: EmbeddingConfig,
  options?: RagOptions,
  documentIds?: string[]
): Promise<RagHit[]> {
  return await invokeCommand<RagHit[]>("rag_search", {
    query,
    config,
    options: options ?? null,
    documentIds: documentIds ?? null,
    document_ids: documentIds ?? null,
  });
}

/** Whole-library RAG chat: retrieve + grounded LLM answer with citations. */
export async function ragChat(
  query: string,
  config: EmbeddingConfig,
  history: LLMMessage[],
  llm: {
    provider: string;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  },
  options?: RagOptions,
  documentIds?: string[]
): Promise<RagChatResponse> {
  return await invokeCommand<RagChatResponse>("rag_chat", {
    query,
    config,
    history,
    options: options ?? null,
    llmProvider: llm.provider,
    llm_model: llm.model,
    llmModel: llm.model,
    llmApiKey: llm.apiKey,
    llm_api_key: llm.apiKey,
    llmBaseUrl: llm.baseUrl,
    llm_base_url: llm.baseUrl,
    documentIds: documentIds ?? null,
    document_ids: documentIds ?? null,
  });
}

/** Subscribe to rag-index-progress events. Returns an unlisten function. */
export async function onRagIndexProgress(
  handler: (progress: RagIndexProgress) => void
): Promise<UnlistenFn> {
  return await listen<RagIndexProgress>("rag-index-progress", (event) => {
    handler(event.payload);
  });
}
