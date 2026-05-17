import { create } from "zustand";
import {
  getCollections,
  createCollection as apiCreateCollection,
  updateCollection as apiUpdateCollection,
  deleteCollection as apiDeleteCollection,
  getActiveCollection,
  setActiveCollection as apiSetActiveCollection,
  getCollectionDueCount,
} from "../api/collections";
import type { Collection } from "../types/collection";
import { DEFAULT_COLLECTION_ID } from "../types/collection";
import { useQueueStore } from "./queueStore";
import { useAnalyticsStore } from "./analyticsStore";
import { useDocumentStore } from "./documentStore";

interface CollectionState {
  collections: Collection[];
  activeCollectionId: string;
  dueCounts: Record<string, number>;
  loaded: boolean;

  loadCollections: () => Promise<void>;
  createCollection: (name: string, icon?: string, color?: string) => Promise<Collection>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  switchCollection: (id: string) => Promise<void>;
  refreshDueCounts: () => Promise<void>;
}

export const useCollectionStore = create<CollectionState>()((set, get) => ({
  collections: [],
  activeCollectionId: DEFAULT_COLLECTION_ID,
  dueCounts: {},
  loaded: false,

  loadCollections: async () => {
    try {
      const [collections, activeId] = await Promise.all([
        getCollections(),
        getActiveCollection(),
      ]);
      set({
        collections,
        activeCollectionId: activeId || DEFAULT_COLLECTION_ID,
        loaded: true,
      });
    } catch (e) {
      console.error("Failed to load collections:", e);
      set({ loaded: true });
    }
  },

  createCollection: async (name, icon, color) => {
    const collection = await apiCreateCollection(name, icon, color);
    set((state) => ({
      collections: [...state.collections, collection],
      activeCollectionId: collection.id,
    }));
    await apiSetActiveCollection(collection.id);
    // Reload data for the new (empty) collection so stale documents don't linger
    useDocumentStore.getState().loadDocuments();
    useQueueStore.getState().loadQueue();
    useAnalyticsStore.getState().loadDashboardStats();
    return collection;
  },

  renameCollection: async (id, name) => {
    const updated = await apiUpdateCollection(id, name);
    set((state) => ({
      collections: state.collections.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteCollection: async (id) => {
    await apiDeleteCollection(id);
    const state = get();
    const newCollections = state.collections.filter((c) => c.id !== id);
    const newActiveId =
      state.activeCollectionId === id
        ? DEFAULT_COLLECTION_ID
        : state.activeCollectionId;
    set({ collections: newCollections, activeCollectionId: newActiveId });
    if (state.activeCollectionId === id) {
      await apiSetActiveCollection(DEFAULT_COLLECTION_ID);
    }
  },

  switchCollection: async (id) => {
    set({ activeCollectionId: id });
    await apiSetActiveCollection(id);
    useDocumentStore.getState().loadDocuments();
    useQueueStore.getState().loadQueue();
    useAnalyticsStore.getState().loadDashboardStats();
  },

  refreshDueCounts: async () => {
    const { collections } = get();
    const counts: Record<string, number> = {};
    await Promise.all(
      collections.map(async (c) => {
        try {
          counts[c.id] = await getCollectionDueCount(c.id);
        } catch {
          counts[c.id] = 0;
        }
      })
    );
    set({ dueCounts: counts });
  },
}));
