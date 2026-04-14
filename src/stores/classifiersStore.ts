/**
 * Classifiers Store
 * Manages RSS intelligence training state (classifiers, intelligence filter)
 */

import { create } from "zustand";
import {
  type RssClassifier,
  type ClassifierUpdate,
  addClassifierAuto,
  removeClassifierAuto,
  getClassifiersAuto,
  updateClassifiersBatchAuto,
  recomputeIntelligenceScoresAuto,
} from "../api/rss-classifiers";

interface ClassifiersState {
  classifiers: RssClassifier[];
  isLoading: boolean;
  error: string | null;

  // Intelligence filter state
  intelligenceFilter: "all" | "focus" | "neutral";
  showDisliked: boolean;

  // Actions
  loadClassifiers: (filters?: {
    feedId?: string;
    folderId?: string;
    classifierType?: string;
    sentiment?: string;
  }) => Promise<void>;
  addClassifier: (
    feedId: string,
    classifierType: string,
    value: string,
    sentiment: string,
    scope?: string
  ) => Promise<void>;
  removeClassifier: (id: string) => Promise<void>;
  updateClassifiersBatch: (updates: ClassifierUpdate[]) => Promise<void>;
  recomputeScores: () => Promise<void>;
  setIntelligenceFilter: (filter: "all" | "focus" | "neutral") => void;
  toggleShowDisliked: () => void;
}

export const useClassifiersStore = create<ClassifiersState>((set, get) => ({
  classifiers: [],
  isLoading: false,
  error: null,
  intelligenceFilter: "all",
  showDisliked: false,

  loadClassifiers: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const classifiers = await getClassifiersAuto(filters);
      set({ classifiers, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  addClassifier: async (feedId, classifierType, value, sentiment, scope = "feed") => {
    try {
      const classifier = await addClassifierAuto(feedId, classifierType, value, sentiment, scope);
      set((s) => ({ classifiers: [...s.classifiers, classifier] }));
      // Recompute intelligence scores so the filter reflects the new classifier
      void get().recomputeScores();
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  removeClassifier: async (id) => {
    try {
      await removeClassifierAuto(id);
      set((s) => ({ classifiers: s.classifiers.filter((c) => c.id !== id) }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  updateClassifiersBatch: async (updates) => {
    try {
      await updateClassifiersBatchAuto(updates);
      set((s) => ({
        classifiers: s.classifiers.map((c) => {
          const update = updates.find((u) => u.id === c.id);
          if (!update) return c;
          return { ...c, sentiment: update.sentiment as RssClassifier["sentiment"], updated_at: new Date().toISOString() };
        }),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  recomputeScores: async () => {
    try {
      await recomputeIntelligenceScoresAuto();
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setIntelligenceFilter: (filter) => set({ intelligenceFilter: filter }),
  toggleShowDisliked: () => set((s) => ({ showDisliked: !s.showDisliked })),
}));
