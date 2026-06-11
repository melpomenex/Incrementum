// Tag-Aware Scheduling (TAS) Zustand slice

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  buildTasQueue,
  setTagPrerequisites,
  getTagMaturityStats,
  getTags,
  upsertTag,
  deleteTag,
  syncTags,
  computeTagCentroids,
  getTasConfig,
  updateTasConfig,
} from "../api/tas";
import {
  DEFAULT_TAS_CONFIG,
  type TASConfig,
  type TASScheduledItem,
  type Tag,
  type TagStabilityStats,
} from "../types/tas";

interface TASState {
  // Configuration (persisted)
  config: TASConfig;

  // Today's TAS-processed queue
  todayQueue: TASScheduledItem[];
  /** Items blocked by prerequisites */
  blockedItems: TASScheduledItem[];
  /** Items in the eligible queue (not blocked, delay elapsed) */
  eligibleItems: TASScheduledItem[];

  // Tags with TAS metadata
  tags: Tag[];

  // Loading / error state
  isLoading: boolean;
  error: string | null;

  // Actions
  buildQueue: (date: string) => Promise<void>;
  setPrerequisites: (tagId: string, prerequisiteIds: string[]) => Promise<void>;
  getStats: (tagId: string) => Promise<TagStabilityStats>;
  loadTags: () => Promise<void>;
  createOrUpdateTag: (params: {
    name: string;
    prerequisites?: string[];
    maturityThreshold?: number;
  }) => Promise<Tag>;
  removeTag: (tagId: string) => Promise<void>;
  syncTags: () => Promise<number>;
  computeCentroids: () => Promise<number>;
  updateConfig: (patch: Partial<TASConfig>) => Promise<void>;
  /** Force-show a blocked/delayed item in this session */
  forceShowItem: (itemId: string) => void;
  /** Reset ephemeral TAS queue state */
  resetQueue: () => void;
}

export const useTASStore = create<TASState>()(
  persist(
    (set, get) => ({
      // Default config
      config: DEFAULT_TAS_CONFIG,

      // Queue state (ephemeral, not persisted)
      todayQueue: [],
      blockedItems: [],
      eligibleItems: [],

      // Tags
      tags: [],

      // State
      isLoading: false,
      error: null,

      // Actions
      buildQueue: async (date: string) => {
        const { config } = get();
        if (!config.enabled) {
          set({ todayQueue: [], blockedItems: [], eligibleItems: [] });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const items = await buildTasQueue(date);
          const blockedItems = items.filter((i) => i.prerequisiteBlocked);
          const eligibleItems = items.filter(
            (i) =>
              !i.prerequisiteBlocked &&
              (!i.interferenceDelayUntil ||
                new Date(i.interferenceDelayUntil) <= new Date())
          );
          set({
            todayQueue: items,
            blockedItems,
            eligibleItems,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: String(err),
            isLoading: false,
          });
        }
      },

      setPrerequisites: async (tagId, prerequisiteIds) => {
        set({ isLoading: true, error: null });
        try {
          await setTagPrerequisites(tagId, prerequisiteIds);
          // Reload tags to get updated state
          await get().loadTags();
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      getStats: async (tagId) => {
        return getTagMaturityStats(tagId);
      },

      loadTags: async () => {
        set({ isLoading: true, error: null });
        try {
          const tags = await getTags();
          set({ tags, isLoading: false });
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      createOrUpdateTag: async (params) => {
        set({ isLoading: true, error: null });
        try {
          const tag = await upsertTag(params);
          await get().loadTags();
          set({ isLoading: false });
          return tag;
        } catch (err) {
          set({ error: String(err), isLoading: false });
          throw err;
        }
      },

      syncTags: async () => {
        set({ isLoading: true, error: null });
        try {
          const count = await syncTags();
          await get().loadTags();
          set({ isLoading: false });
          return count;
        } catch (err) {
          set({ error: String(err), isLoading: false });
          throw err;
        }
      },

      computeCentroids: async () => {
        set({ isLoading: true, error: null });
        try {
          const count = await computeTagCentroids();
          await get().loadTags();
          set({ isLoading: false });
          return count;
        } catch (err) {
          set({ error: String(err), isLoading: false });
          throw err;
        }
      },

      removeTag: async (tagId) => {
        set({ isLoading: true, error: null });
        try {
          await deleteTag(tagId);
          await get().loadTags();
          set({ isLoading: false });
        } catch (err) {
          set({ error: String(err), isLoading: false });
          throw err;
        }
      },

      updateConfig: async (patch) => {
        const current = get().config;
        const newConfig: TASConfig = {
          ...current,
          ...patch,
          interference: { ...current.interference, ...(patch.interference || {}) },
          prerequisites: {
            ...current.prerequisites,
            ...(patch.prerequisites || {}),
          },
        };
        set({ config: newConfig, error: null });
        try {
          await updateTasConfig(newConfig);
        } catch (err) {
          set({ error: String(err) });
        }
      },

      forceShowItem: (itemId) => {
        const { blockedItems } = get();
        const item = blockedItems.find((i) => i.itemId === itemId);
        if (item) {
          set({
            blockedItems: blockedItems.filter((i) => i.itemId !== itemId),
            eligibleItems: [...get().eligibleItems, { ...item, prerequisiteBlocked: false, interferenceDelayUntil: undefined, blockReason: undefined }],
          });
        }
      },

      resetQueue: () => {
        set({ todayQueue: [], blockedItems: [], eligibleItems: [] });
      },
    }),
    {
      name: "tas-storage",
      partialize: (state) => ({ config: state.config }),
    }
  )
);
