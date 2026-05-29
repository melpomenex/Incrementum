import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type FeedItem } from "../api/rss";

export interface RssStudyState {
  selectedRssItems: FeedItem[];
  selectedFeeds: string[];
  selectedFolders: string[];
  includeAllUnread: boolean;
  includeFavorites: boolean;
  activeArticleToView: string | null;

  // Actions
  addRssItemToBatch: (item: FeedItem) => void;
  removeRssItemFromBatch: (itemId: string) => void;
  clearBatch: () => void;
  toggleFeedInBatch: (feedId: string) => void;
  toggleFolderInBatch: (folderId: string) => void;
  setIncludeAllUnread: (val: boolean) => void;
  setIncludeFavorites: (val: boolean) => void;
  setActiveArticleToView: (id: string | null) => void;
}

export const useRssStudyStore = create<RssStudyState>()(
  persist(
    (set) => ({
      selectedRssItems: [],
      selectedFeeds: [],
      selectedFolders: [],
      includeAllUnread: false,
      includeFavorites: false,
      activeArticleToView: null,

      addRssItemToBatch: (item) =>
        set((state) => {
          if (state.selectedRssItems.some((i) => i.id === item.id)) {
            return {};
          }
          return { selectedRssItems: [...state.selectedRssItems, item] };
        }),

      removeRssItemFromBatch: (itemId) =>
        set((state) => ({
          selectedRssItems: state.selectedRssItems.filter((i) => i.id !== itemId),
        })),

      clearBatch: () =>
        set({
          selectedRssItems: [],
          selectedFeeds: [],
          selectedFolders: [],
          includeAllUnread: false,
          includeFavorites: false,
        }),

      toggleFeedInBatch: (feedId) =>
        set((state) => {
          const feeds = state.selectedFeeds.includes(feedId)
            ? state.selectedFeeds.filter((id) => id !== feedId)
            : [...state.selectedFeeds, feedId];
          return { selectedFeeds: feeds };
        }),

      toggleFolderInBatch: (folderId) =>
        set((state) => {
          const folders = state.selectedFolders.includes(folderId)
            ? state.selectedFolders.filter((id) => id !== folderId)
            : [...state.selectedFolders, folderId];
          return { selectedFolders: folders };
        }),

      setIncludeAllUnread: (val) => set({ includeAllUnread: val }),
      setIncludeFavorites: (val) => set({ includeFavorites: val }),
      setActiveArticleToView: (id) => set({ activeArticleToView: id }),
    }),
    {
      name: "rss-study-store",
    }
  )
);
