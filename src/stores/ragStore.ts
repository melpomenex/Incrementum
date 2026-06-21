/**
 * Zustand store for whole-library RAG chat state: index status, indexing
 * progress, and the last chat result (answer + citations).
 */

import { create } from "zustand";
import {
  ragIndexStatus,
  ragIndexCollection,
  onRagIndexProgress,
  buildRagOptions,
  type RagChatResponse,
  type RagIndexProgress,
  type RagIndexStatus,
} from "../api/rag";
import { resolveEmbeddingConfigForRag } from "../components/assistant/ragConfig";
import { useSettingsStore } from "./settingsStore";

// Re-export so callers can resolve the config without importing from components.
export { resolveEmbeddingConfigForRag as resolveEmbeddingConfig };

interface RagState {
  status: RagIndexStatus | null;
  isLoadingStatus: boolean;
  isIndexing: boolean;
  indexProgress: RagIndexProgress | null;
  lastError: string | null;
  lastChat: RagChatResponse | null;
  isChatting: boolean;

  refreshStatus: () => Promise<void>;
  indexCollection: () => Promise<void>;
  setLastChat: (response: RagChatResponse | null) => void;
  setChatting: (v: boolean) => void;
  clearError: () => void;
}

let unlistenProgress: (() => void) | null = null;

export const useRagStore = create<RagState>((set, get) => ({
  status: null,
  isLoadingStatus: false,
  isIndexing: false,
  indexProgress: null,
  lastError: null,
  lastChat: null,
  isChatting: false,

  refreshStatus: async () => {
    set({ isLoadingStatus: true, lastError: null });
    try {
      const config = await resolveEmbeddingConfigForRag();
      const status = await ragIndexStatus(config);
      set({ status, isLoadingStatus: false });
    } catch (e) {
      set({
        isLoadingStatus: false,
        lastError: e instanceof Error ? e.message : "Failed to load RAG status",
      });
    }
  },

  indexCollection: async () => {
    set({ isIndexing: true, indexProgress: null, lastError: null });
    try {
      const config = await resolveEmbeddingConfigForRag();
      const options = buildRagOptions(useSettingsStore.getState().settings.embedding);

      if (!unlistenProgress) {
        unlistenProgress = await onRagIndexProgress((p) => {
          set({ indexProgress: p });
        });
      }

      await ragIndexCollection(config, options);
      await get().refreshStatus();
    } catch (e) {
      set({
        lastError: e instanceof Error ? e.message : "RAG indexing failed",
      });
    } finally {
      set({ isIndexing: false });
    }
  },

  setLastChat: (response) => set({ lastChat: response }),
  setChatting: (v) => set({ isChatting: v }),
  clearError: () => set({ lastError: null }),
}));
