import { create } from "zustand";
import {
  getQueue,
  getDueDocumentsOnly,
  getDueQueueItems,
  getQueueStats,
  postponeItem,
  bulkSuspendItems,
  bulkUnsuspendItems,
  bulkDeleteItems,
  type BulkOperationResult,
  type QueueStats
} from "../api/queue";
import { getAllLearningItems } from "../api/learning-items";
import { useCollectionStore } from "./collectionStore";
import type { QueueItem, SortOptions, SearchFilters } from "../types";
import { useDocumentStore } from "./documentStore";
import { useSettingsStore } from "./settingsStore";
import {
  postponeElement,
  postponeAll as enginePostponeAll,
  computePriority,
  type PostponeConfig,
  type PostponeInput,
  type PostponeStats,
} from "../lib/postpone";

// Queue filter modes for FSRS-based scheduling
export type QueueFilterMode = "due-today" | "all-items" | "new-only" | "due-all";

interface QueueState {
  // Data
  items: QueueItem[];
  filteredItems: QueueItem[];
  selectedIds: Set<string>;
  stats: QueueStats | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filters: SearchFilters;
  sortOptions: SortOptions;
  queueFilterMode: QueueFilterMode; // FSRS queue filter mode
  bulkOperationLoading: boolean;
  bulkOperationResult: BulkOperationResult | null;

  // Postpone state
  postponeLoading: boolean;
  postponeStats: PostponeStats | null;
  showAutoPostponePrompt: boolean;

  // Actions
  loadQueue: () => Promise<void>;
  loadDueDocumentsOnly: () => Promise<void>;
  loadDueQueueItems: () => Promise<void>;
  setQueueFilterMode: (mode: QueueFilterMode) => void;
  loadStats: () => Promise<void>;
  setItems: (items: QueueItem[]) => void;
  setSelected: (id: string, selected: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: SearchFilters) => void;
  setSortOptions: (sort: SortOptions) => void;
  applyFilters: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Bulk operations
  postponeItem: (id: string, days: number) => Promise<void>;
  postponeItemSmart: (queueItem: QueueItem) => Promise<{ increase: number; newInterval: number }>;
  postponeAllItems: () => Promise<PostponeStats>;
  dismissAutoPostponePrompt: () => void;
  bulkSuspend: () => Promise<void>;
  bulkUnsuspend: () => Promise<void>;
  bulkDelete: () => Promise<void>;
  clearBulkResult: () => void;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  // Initial State
  items: [],
  filteredItems: [],
  selectedIds: new Set<string>(),
  stats: null,
  isLoading: false,
  error: null,
  searchQuery: "",
  filters: {},
  sortOptions: {
    field: "priority",
    direction: "desc",
  },
  queueFilterMode: "due-all", // Default to due-only to avoid resurfacing reviewed items
  bulkOperationLoading: false,
  bulkOperationResult: null,
  postponeLoading: false,
  postponeStats: null,
  showAutoPostponePrompt: false,

  // Actions
  loadQueue: async () => {
    set({ isLoading: true, error: null });
    try {
      const mode = get().queueFilterMode;
      const collectionId = useCollectionStore.getState().activeCollectionId;
      console.log("[queue] loadQueue called, collectionId:", collectionId, "mode:", mode);
      let items: QueueItem[] = [];
      switch (mode) {
        case "due-today":
          items = await getDueDocumentsOnly(collectionId);
          break;
        case "due-all":
          items = await getDueQueueItems(undefined, collectionId);
          break;
        case "all-items":
        case "new-only":
        default:
          items = await getQueue(collectionId);
          break;
      }
      const now = new Date();
      set({
        items,
        isLoading: false,
      });
      get().applyFilters();

      // Check auto-postpone prompt
      const settings = useSettingsStore.getState().settings;
      if (settings.learning.postpone.autoPostponeEnabled) {
        const overdueCount = items.filter((i) => {
          if (!i.dueDate) return true;
          return new Date(i.dueDate) < now;
        }).length;
        if (overdueCount > 0) {
          set({ showAutoPostponePrompt: true });
        }
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load queue",
        isLoading: false,
      });
    }
  },

  loadStats: async () => {
    try {
      const stats = await getQueueStats();
      set({ stats });
    } catch (error) {
      console.error("Failed to load queue stats:", error);
    }
  },

  // Load only due documents (FSRS-scheduled with next_reading_date <= now or never read)
  loadDueDocumentsOnly: async () => {
    set({ isLoading: true, error: null });
    try {
      const collectionId = useCollectionStore.getState().activeCollectionId;
      const items = await getDueDocumentsOnly(collectionId);
      set({
        items,
        isLoading: false,
      });
      get().applyFilters();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load due documents",
        isLoading: false,
      });
    }
  },

  // Load due queue items (includes documents, extracts, and learning items)
  loadDueQueueItems: async () => {
    set({ isLoading: true, error: null });
    try {
      const collectionId = useCollectionStore.getState().activeCollectionId;
      const items = await getDueQueueItems(undefined, collectionId);
      set({
        items,
        isLoading: false,
      });
      get().applyFilters();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load due items",
        isLoading: false,
      });
    }
  },

  // Set the queue filter mode and reload accordingly
  setQueueFilterMode: async (mode: QueueFilterMode) => {
    set({ queueFilterMode: mode });
    // Reload queue based on the new filter mode
    switch (mode) {
      case "due-today":
        await get().loadDueDocumentsOnly();
        break;
      case "due-all":
        await get().loadDueQueueItems();
        break;
      case "all-items":
      case "new-only":
      default:
        await get().loadQueue();
        break;
    }
  },

  setItems: (items) =>
    set({
      items,
      filteredItems: items,
    }),

  setSelected: (id, selected) =>
    set((state) => {
      const newSelected = new Set(state.selectedIds);
      if (selected) {
        newSelected.add(id);
      } else {
        newSelected.delete(id);
      }
      return { selectedIds: newSelected };
    }),

  selectAll: () =>
    set((state) => {
      const newSelected = new Set<string>();
      state.filteredItems.forEach((item) => {
        if (item.itemType === "learning-item") {
          newSelected.add(item.id);
        }
      });
      return { selectedIds: newSelected };
    }),

  clearSelection: () => set({ selectedIds: new Set<string>() }),

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().applyFilters();
  },

  setFilters: (filters) => {
    set({ filters });
    get().applyFilters();
  },

  setSortOptions: (sort) => {
    set({ sortOptions: sort });
    get().applyFilters();
  },

  applyFilters: () => {
    const { items, searchQuery, filters, sortOptions } = get();
    let filtered = [...items];
    const documents = useDocumentStore.getState().documents;
    const archivedDocumentIds = new Set(
      documents.filter((doc) => doc.isArchived).map((doc) => doc.id)
    );
    const dismissedDocumentIds = new Set(
      documents.filter((doc) => doc.isDismissed).map((doc) => doc.id)
    );

    // Collection filtering is now handled by the backend

    if (archivedDocumentIds.size > 0) {
      filtered = filtered.filter((item) => !item.documentId || !archivedDocumentIds.has(item.documentId));
    }

    // Filter out dismissed documents from queue view (they remain searchable)
    if (dismissedDocumentIds.size > 0) {
      filtered = filtered.filter((item) => !item.documentId || !dismissedDocumentIds.has(item.documentId));
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.documentTitle.toLowerCase().includes(query) ||
          (item.tags ?? []).some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply filters
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter((item) =>
        filters.categories?.includes(item.category || "")
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter((item) =>
        (item.tags ?? []).some((tag) => filters.tags?.includes(tag))
      );
    }

    if (filters.minPriority !== undefined) {
      filtered = filtered.filter((item) => item.priority >= filters.minPriority!);
    }

    if (filters.maxPriority !== undefined) {
      filtered = filtered.filter((item) => item.priority <= filters.maxPriority!);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const key = sortOptions.field;
      const aVal = key === "title" ? a.documentTitle : a.priority;
      const bVal = key === "title" ? b.documentTitle : b.priority;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOptions.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOptions.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    set({ filteredItems: filtered });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  // Bulk operations

  /**
   * Map queue items to PostponeInput using settings and available data.
   * For learning items, fetches full data from the API.
   * For documents, uses the document store.
   */
  postponeItemSmart: async (queueItem) => {
    const settings = useSettingsStore.getState().settings;
    const ps = settings.learning.postpone;
    const config: PostponeConfig = {
      itemIncrease: ps.itemIncrease,
      itemMinIncrease: ps.itemMinIncrease,
      itemMaxIncrease: ps.itemMaxIncrease,
      itemCap: ps.itemCap,
      itemFloor: ps.itemFloor,
      topicIncrease: ps.topicIncrease,
      topicMinIncrease: ps.topicMinIncrease,
      topicMaxIncrease: ps.topicMaxIncrease,
      topicCap: ps.topicCap,
      topicFloor: ps.topicFloor,
      minElapsed: ps.minElapsed,
      minPriority: ps.minPriority,
      minPriority2: ps.minPriority2,
      minStability: ps.minStability,
      topicPriorityMin: ps.topicPriorityMin,
      topicRepMin: ps.topicRepMin,
      topicElapsedMin: ps.topicElapsedMin,
      randomize: ps.randomize,
      simpleMode: ps.simpleMode,
      checkItemSkip: true,
      checkTopicSkip: true,
      skipTopics: false,
    };

    const now = new Date();

    if (queueItem.itemType === "document") {
      const docs = useDocumentStore.getState().documents;
      const doc = docs.find((d) => d.id === queueItem.documentId);
      if (!doc) throw new Error("Document not found");

      const lastReview = doc.dateLastReviewed ? new Date(doc.dateLastReviewed) : null;
      const daysSinceReview = lastReview
        ? Math.max(0, Math.floor((now.getTime() - lastReview.getTime()) / 86400000))
        : 0;
      const interval = doc.nextReadingDate
        ? Math.max(0, Math.floor((new Date(doc.nextReadingDate).getTime() - now.getTime()) / 86400000))
        : 0;

      const input: PostponeInput = {
        id: queueItem.id,
        type: "topic",
        interval,
        priority: queueItem.priority,
        stability: doc.stability ?? 1,
        difficulty: doc.difficulty ?? 3,
        reviewCount: doc.reps ?? doc.readingCount ?? 0,
        lapses: 0,
        daysSinceReview,
      };

      const result = postponeElement(input, config);
      if (result.postponed) {
        await postponeItem(queueItem.id, result.increase);
        await get().loadQueue();
      }
      return { increase: result.increase, newInterval: result.newInterval };
    }

    // Learning item
    const itemId = queueItem.learningItemId ?? queueItem.id;
    const item = await getAllLearningItems().then((items) => items.find((i) => i.id === itemId));
    if (!item) throw new Error("Learning item not found");

    const stability = item.memory_state?.stability ?? 1;
    const difficulty = item.memory_state?.difficulty ?? item.difficulty ?? 3;
    const lastReview = item.last_review_date ? new Date(item.last_review_date) : null;
    const daysSinceReview = lastReview
      ? Math.max(0, Math.floor((now.getTime() - lastReview.getTime()) / 86400000))
      : 0;

    const input: PostponeInput = {
      id: queueItem.id,
      type: "item",
      interval: item.interval,
      priority: computePriority(stability, difficulty, item.lapses),
      stability,
      difficulty,
      reviewCount: item.review_count,
      lapses: item.lapses,
      daysSinceReview,
    };

    const result = postponeElement(input, config);
    if (result.postponed) {
      await postponeItem(queueItem.id, result.increase);
      await get().loadQueue();
    }
    return { increase: result.increase, newInterval: result.newInterval };
  },

  /**
   * Postpone all items in the current queue using the algorithm-aware engine.
   */
  postponeAllItems: async () => {
    const { filteredItems } = get();
    if (filteredItems.length === 0) {
      return { totalItems: 0, postponedCount: 0, skippedCount: 0, totalIncrease: 0, averageIncrease: 0 };
    }

    set({ postponeLoading: true, error: null, postponeStats: null });
    try {
      const settings = useSettingsStore.getState().settings;
      const ps = settings.learning.postpone;
      const config: PostponeConfig = {
        itemIncrease: ps.itemIncrease,
        itemMinIncrease: ps.itemMinIncrease,
        itemMaxIncrease: ps.itemMaxIncrease,
        itemCap: ps.itemCap,
        itemFloor: ps.itemFloor,
        topicIncrease: ps.topicIncrease,
        topicMinIncrease: ps.topicMinIncrease,
        topicMaxIncrease: ps.topicMaxIncrease,
        topicCap: ps.topicCap,
        topicFloor: ps.topicFloor,
        minElapsed: ps.minElapsed,
        minPriority: ps.minPriority,
        minPriority2: ps.minPriority2,
        minStability: ps.minStability,
        topicPriorityMin: ps.topicPriorityMin,
        topicRepMin: ps.topicRepMin,
        topicElapsedMin: ps.topicElapsedMin,
        randomize: ps.randomize,
        simpleMode: ps.simpleMode,
        checkItemSkip: true,
        checkTopicSkip: true,
        skipTopics: false,
      };

      const now = new Date();
      const docs = useDocumentStore.getState().documents;
      const docMap = new Map(docs.map((d) => [d.id, d]));

      // Fetch all learning items for batch lookup
      const allLearningItems = await getAllLearningItems();
      const liMap = new Map(allLearningItems.map((li) => [li.id, li]));

      const inputs: PostponeInput[] = [];
      const queueItemMap = new Map<string, QueueItem>();

      for (const qi of filteredItems) {
        queueItemMap.set(qi.id, qi);

        if (qi.itemType === "document") {
          const doc = docMap.get(qi.documentId);
          if (!doc) continue;

          const lastReview = doc.dateLastReviewed ? new Date(doc.dateLastReviewed) : null;
          const daysSinceReview = lastReview
            ? Math.max(0, Math.floor((now.getTime() - lastReview.getTime()) / 86400000))
            : 0;
          const interval = doc.nextReadingDate
            ? Math.max(0, Math.floor((new Date(doc.nextReadingDate).getTime() - now.getTime()) / 86400000))
            : 0;

          inputs.push({
            id: qi.id,
            type: "topic",
            interval,
            priority: qi.priority,
            stability: doc.stability ?? 1,
            difficulty: doc.difficulty ?? 3,
            reviewCount: doc.reps ?? doc.readingCount ?? 0,
            lapses: 0,
            daysSinceReview,
          });
        } else if (qi.learningItemId) {
          const item = liMap.get(qi.learningItemId);
          if (!item) continue;

          const stability = item.memory_state?.stability ?? 1;
          const difficulty = item.memory_state?.difficulty ?? item.difficulty ?? 3;
          const lastReview = item.last_review_date ? new Date(item.last_review_date) : null;
          const daysSinceReview = lastReview
            ? Math.max(0, Math.floor((now.getTime() - lastReview.getTime()) / 86400000))
            : 0;

          inputs.push({
            id: qi.id,
            type: "item",
            interval: item.interval,
            priority: computePriority(stability, difficulty, item.lapses),
            stability,
            difficulty,
            reviewCount: item.review_count,
            lapses: item.lapses,
            daysSinceReview,
          });
        }
      }

      const { results, stats } = enginePostponeAll(inputs, config);

      // Persist postponed items
      for (const result of results) {
        if (result.postponed) {
          await postponeItem(result.id, result.increase);
        }
      }

      set({ postponeStats: stats, postponeLoading: false });
      await get().loadQueue();
      await get().loadStats();
      return stats;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to postpone items",
        postponeLoading: false,
      });
      throw error;
    }
  },

  dismissAutoPostponePrompt: () => set({ showAutoPostponePrompt: false }),

  postponeItem: async (id, days) => {
    try {
      await postponeItem(id, days);
      // Reload queue to get updated data
      await get().loadQueue();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to postpone item",
      });
      throw error;
    }
  },

  bulkSuspend: async () => {
    const { selectedIds } = get();
    if (selectedIds.size === 0) return;

    set({ bulkOperationLoading: true, error: null, bulkOperationResult: null });
    try {
      const result = await bulkSuspendItems(Array.from(selectedIds));
      set({ bulkOperationResult: result, bulkOperationLoading: false });

      // Reload queue to get updated data
      await get().loadQueue();
      await get().loadStats();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to suspend items",
        bulkOperationLoading: false,
      });
      throw error;
    }
  },

  bulkUnsuspend: async () => {
    const { selectedIds } = get();
    if (selectedIds.size === 0) return;

    set({ bulkOperationLoading: true, error: null, bulkOperationResult: null });
    try {
      const result = await bulkUnsuspendItems(Array.from(selectedIds));
      set({ bulkOperationResult: result, bulkOperationLoading: false });

      // Reload queue to get updated data
      await get().loadQueue();
      await get().loadStats();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to unsuspend items",
        bulkOperationLoading: false,
      });
      throw error;
    }
  },

  bulkDelete: async () => {
    const { selectedIds } = get();
    if (selectedIds.size === 0) return;

    set({ bulkOperationLoading: true, error: null, bulkOperationResult: null });
    try {
      const result = await bulkDeleteItems(Array.from(selectedIds));
      set({ bulkOperationResult: result, bulkOperationLoading: false });

      // Clear selection and reload queue
      set({ selectedIds: new Set<string>() });
      await get().loadQueue();
      await get().loadStats();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to delete items",
        bulkOperationLoading: false,
      });
      throw error;
    }
  },

  clearBulkResult: () => set({ bulkOperationResult: null }),
}));

// Lazy subscribe to avoid circular import: collectionStore imports queueStore.
// The guard ensures both the store reference and its .subscribe method exist.
if (typeof useCollectionStore !== "undefined" && typeof useCollectionStore.subscribe === "function") {
  useCollectionStore.subscribe(
    () => {
      const { applyFilters } = useQueueStore.getState();
      applyFilters();
    }
  );
}
