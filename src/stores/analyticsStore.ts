import { create } from "zustand";
import {
  getDashboardStats,
  getMemoryStats,
  getActivityData,
  getCategoryStats,
  getLeechDashboard,
  type DashboardStats,
  type MemoryStats,
  type ActivityDay,
  type CategoryStats,
  type LeechItem,
} from "../api/analytics";
import { useCollectionStore } from "./collectionStore";

interface AnalyticsState {
  dashboardStats: DashboardStats | null;
  memoryStats: MemoryStats | null;
  activityData: ActivityDay[];
  categoryStats: CategoryStats[];
  leechItems: LeechItem[];

  isLoading: boolean;
  error: string | null;

  // Actions
  loadDashboardStats: () => Promise<void>;
  loadMemoryStats: () => Promise<void>;
  loadActivityData: (days?: number) => Promise<void>;
  loadCategoryStats: () => Promise<void>;
  loadLeechDashboard: (threshold?: number) => Promise<void>;
  loadAll: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  dashboardStats: null,
  memoryStats: null,
  activityData: [],
  categoryStats: [],
  leechItems: [],

  isLoading: false,
  error: null,

  loadDashboardStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const collectionId = useCollectionStore.getState().activeCollectionId;
      const stats = await getDashboardStats(collectionId);
      set({ dashboardStats: stats, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load dashboard stats",
        isLoading: false,
      });
    }
  },

  loadMemoryStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const stats = await getMemoryStats();
      set({ memoryStats: stats, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load memory stats",
        isLoading: false,
      });
    }
  },

  loadActivityData: async (days = 30) => {
    set({ isLoading: true, error: null });
    try {
      const data = await getActivityData(days);
      set({ activityData: data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load activity data",
        isLoading: false,
      });
    }
  },

  loadCategoryStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const stats = await getCategoryStats();
      set({ categoryStats: stats, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load category stats",
        isLoading: false,
      });
    }
  },

  loadLeechDashboard: async (threshold = 8) => {
    set({ isLoading: true, error: null });
    try {
      const leechItems = await getLeechDashboard(threshold);
      set({ leechItems, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load leech dashboard",
        isLoading: false,
      });
    }
  },

  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const [dashboardStats, memoryStats, activityData, categoryStats, leechItems] = await Promise.all([
        getDashboardStats(),
        getMemoryStats(),
        getActivityData(30),
        getCategoryStats(),
        getLeechDashboard(8),
      ]);
      set({
        dashboardStats,
        memoryStats,
        activityData,
        categoryStats,
        leechItems,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load analytics",
        isLoading: false,
      });
    }
  },
}));
