import { create } from "zustand";
import type { ComponentType, ReactNode } from "react";
import { generateId } from "../utils/id";
import { useUIStore } from "./uiStore";
import { useCollectionStore } from "./collectionStore";
import { useSettingsStore } from "./settingsStore";

export type TabType =
  | "continue-reading"
  | "dashboard"
  | "queue"
  | "queue-scroll"
  | "review"
  | "documents"
  | "document-viewer"
  | "analytics"
  | "settings"
  | "knowledge-sphere"
  | "knowledge-network"
  | "rss"
  | "newsletter"
  | "web-browser"
  | "doc-qa"
  | "notebooklm"
  | "image-registry"
  | "podcast"
  | "audiobook-epub-sync";

export interface Tab {
  id: string;
  title: string;
  icon: ReactNode;
  type: TabType;
  content: ComponentType;
  closable: boolean;
  data?: Record<string, unknown>;
}

// Split direction for panes
export type SplitDirection = "horizontal" | "vertical";

// Pane can either contain tabs or be split into more panes
export interface TabPane {
  id: string;
  type: "tabs";
  tabIds: string[];
  activeTabId: string | null;
}

export interface SplitPane {
  id: string;
  type: "split";
  direction: SplitDirection;
  sizes: number[]; // Percentages for each child
  children: Pane[];
}

export type Pane = TabPane | SplitPane;

export function normalizePane(pane: Pane | null | undefined): Pane {
  if (!pane || typeof pane !== "object") {
    return createTabPane();
  }

  if (pane.type === "tabs") {
    const tabIds = Array.isArray(pane.tabIds) ? pane.tabIds : [];
    const activeTabId =
      pane.activeTabId && tabIds.includes(pane.activeTabId) ? pane.activeTabId : tabIds[0] ?? null;
    const changed = tabIds !== pane.tabIds || activeTabId !== pane.activeTabId;
    return changed ? { ...pane, tabIds, activeTabId } : pane;
  }

  const children = Array.isArray(pane.children) ? pane.children : [];
  const normalizedChildren = children.map(normalizePane);
  let sizes = Array.isArray(pane.sizes) ? pane.sizes : [];
  const sizesValid =
    sizes.length === normalizedChildren.length &&
    sizes.every((size) => typeof size === "number" && Number.isFinite(size));
  if (!sizesValid) {
    const count = normalizedChildren.length || 1;
    const equal = 100 / count;
    sizes = Array.from({ length: count }, () => equal);
  }

  const changed =
    pane.children !== normalizedChildren ||
    pane.sizes !== sizes ||
    normalizedChildren.some((child, index) => child !== children[index]);

  return changed ? { ...pane, children: normalizedChildren, sizes } : pane;
}

// Helper to create a new tab pane
export function createTabPane(tabIds: string[] = [], activeTabId: string | null = null): TabPane {
  return {
    id: generateId(),
    type: "tabs",
    tabIds,
    activeTabId,
  };
}

// Helper to create a new split pane
export function createSplitPane(
  direction: SplitDirection,
  children: Pane[],
  sizes?: number[]
): SplitPane {
  const defaultSizes = children.map(() => 100 / children.length);
  return {
    id: generateId(),
    type: "split",
    direction,
    sizes: sizes || defaultSizes,
    children,
  };
}

export interface TabsState {
  // State
  tabs: Tab[];
  rootPane: Pane;
  closedTabs: Tab[];
  activeTabHistory: string[];
  // Tabs the user navigated "back" past — consumed by goToNextTab() (the
  // forward counterpart to the edge-swipe-back gesture). Mirrors the back
  // history's most-recent-last ordering.
  forwardTabHistory: string[];

  // Actions
  addTab: (tab: Omit<Tab, "id">, targetPaneId?: string) => string;
  addTabInBackground: (tab: Omit<Tab, "id">, targetPaneId?: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (paneId: string, tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  reopenLastClosedTab: () => void;
  // Navigate to the previous tab (edge-swipe back). Returns true if navigation
  // happened — useful for callers that want to confirm a gesture was consumed.
  goToPreviousTab: () => boolean;
  // Navigate forward (edge-swipe forward). Returns true if navigation happened.
  goToNextTab: () => boolean;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  closeAllTabs: () => void;
  moveTab: (fromIndex: number, toIndex: number, paneId?: string) => void;
  moveTabToPane: (tabId: string, fromPaneId: string, toPaneId: string, targetIndex?: number) => void;
  
  // Split actions
  splitPane: (paneId: string, tabId: string, direction: SplitDirection, side: "before" | "after") => void;
  spawnTabInSplit: (paneId: string, tabId: string, direction: SplitDirection, side: "before" | "after") => void;
  moveTabToSplit: (tabId: string, fromPaneId: string, targetPaneId: string, direction: SplitDirection, side: "before" | "after") => void;
  resizeSplit: (splitPaneId: string, newSizes: number[]) => void;
  collapseSplit: (splitPaneId: string, childPaneId: string) => void;
  
  // Pane queries
  findPaneById: (paneId: string) => Pane | null;
  findPaneContainingTab: (tabId: string) => TabPane | null;
  getAllPaneIds: () => string[];
  getTabPaneIds: () => string[];

  // Persistence
  saveTabs: () => void;
  loadTabs: () => Promise<boolean>;
  getDefaultTabs: () => Tab[];
}

const STORAGE_KEY = "incrementum-tabs";
const SINGLE_INSTANCE_TAB_TYPES: ReadonlySet<TabType> = new Set([
  "continue-reading",
  "dashboard",
  "queue",
  "queue-scroll",
  "review",
  "documents",
  "analytics",
  "settings",
  "knowledge-sphere",
  "knowledge-network",
  "rss",
  "newsletter",
  "doc-qa",
  "notebooklm",
]);

function findReusableTab(state: TabsState, tab: Omit<Tab, "id">): Tab | undefined {
  if (SINGLE_INSTANCE_TAB_TYPES.has(tab.type)) {
    return state.tabs.find((existingTab) => existingTab.type === tab.type);
  }

  return state.tabs.find(
    (existingTab) =>
      existingTab.type === tab.type &&
      JSON.stringify(existingTab.data) === JSON.stringify(tab.data)
  );
}

// Helper to find a pane by ID recursively
function findPaneByIdRecursive(pane: Pane, paneId: string): Pane | null {
  if (pane.id === paneId) return pane;
  if (pane.type === "split") {
    for (const child of pane.children) {
      const found = findPaneByIdRecursive(child, paneId);
      if (found) return found;
    }
  }
  return null;
}

// Helper to find parent of a pane
function findParentPane(pane: Pane, targetId: string): SplitPane | null {
  if (pane.type === "split") {
    for (const child of pane.children) {
      if (child.id === targetId) return pane;
      const found = findParentPane(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

// Helper to find pane containing a tab
function findPaneContainingTabRecursive(pane: Pane, tabId: string): TabPane | null {
  if (pane.type === "tabs" && pane.tabIds.includes(tabId)) {
    return pane;
  }
  if (pane.type === "split") {
    for (const child of pane.children) {
      const found = findPaneContainingTabRecursive(child, tabId);
      if (found) return found;
    }
  }
  return null;
}

// Helper to collect all pane IDs
function collectPaneIds(pane: Pane, ids: string[] = []): string[] {
  ids.push(pane.id);
  if (pane.type === "split") {
    for (const child of pane.children) {
      collectPaneIds(child, ids);
    }
  }
  return ids;
}

// Helper to collect all tab pane IDs
function collectTabPaneIds(pane: Pane, ids: string[] = []): string[] {
  if (pane.type === "tabs") {
    ids.push(pane.id);
  } else if (pane.type === "split") {
    for (const child of pane.children) {
      collectTabPaneIds(child, ids);
    }
  }
  return ids;
}

// Helper to update pane in tree
function updatePaneInTree(root: Pane, paneId: string, updater: (pane: Pane) => Pane): Pane {
  if (root.id === paneId) {
    return updater(root);
  }
  if (root.type === "split") {
    return {
      ...root,
      children: root.children.map((child) => updatePaneInTree(child, paneId, updater)),
    };
  }
  return root;
}

// Helper to remove pane from tree
function removePaneFromTree(root: Pane, paneId: string): Pane | null {
  // If root is the pane being removed, return null to remove it
  if (root.id === paneId) {
    return null;
  }

  if (root.type === "split") {
    // We need to track both the new children and their ORIGINAL sizes to recalculate correctly
    const keptChildrenWithSizes: { pane: Pane; size: number }[] = [];

    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i];
      const newChild = removePaneFromTree(child, paneId);
      if (newChild) {
        keptChildrenWithSizes.push({ pane: newChild, size: root.sizes[i] });
      }
    }

    if (keptChildrenWithSizes.length === 0) {
      return null;
    }
    if (keptChildrenWithSizes.length === 1) {
      // Collapse split with single child
      return keptChildrenWithSizes[0].pane;
    }

    // Recalculate sizes based on the remaining children's original sizes
    const totalSize = keptChildrenWithSizes.reduce((sum, item) => sum + item.size, 0);
    const newSizes = keptChildrenWithSizes.map((item) => (item.size / totalSize) * 100);
    const newChildren = keptChildrenWithSizes.map((item) => item.pane);

    return { ...root, children: newChildren, sizes: newSizes };
  }
  return root;
}

// Serialized tab data shape from localStorage
interface SerializedTabData {
  id: string;
  title: string;
  icon: string;
  type: TabType;
  closable: boolean;
  data?: Record<string, unknown>;
}

function filterInvalidTabsFromPane(pane: Pane, validTabIds: Set<string>): Pane {
  if (pane.type === "tabs") {
    const tabIds = pane.tabIds.filter((id) => validTabIds.has(id));
    const activeTabId =
      pane.activeTabId && tabIds.includes(pane.activeTabId)
        ? pane.activeTabId
        : tabIds[0] ?? null;
    return { ...pane, tabIds, activeTabId };
  }
  return {
    ...pane,
    children: pane.children.map((child) => filterInvalidTabsFromPane(child, validTabIds)),
  };
}

// Collapse empty TabPanes from the tree
function cleanupEmptyPanes(pane: Pane): Pane {
  if (pane.type === "tabs") return pane;

  const cleanedChildren = pane.children
    .map(cleanupEmptyPanes)
    .filter((child): child is Pane => {
      if (child.type === "tabs") return child.tabIds.length > 0;
      return child.children.length > 0;
    });

  if (cleanedChildren.length === 0) return createTabPane();
  if (cleanedChildren.length === 1) return cleanedChildren[0];

  const totalSize = cleanedChildren.reduce((sum) => sum + 100 / cleanedChildren.length, 0);
  const sizes = cleanedChildren.map(() => (100 / cleanedChildren.length));

  return { ...pane, children: cleanedChildren, sizes };
}

export const useTabsStore = create<TabsState>((set, get) => ({
  // Initial State
  tabs: [],
  rootPane: createTabPane(),
  closedTabs: [],
  activeTabHistory: [],
  forwardTabHistory: [],

  getDefaultTabs: () => {
    return [];
  },

  // Add a new tab
  addTab: (tab, targetPaneId?) => {
    const state = get();
    const existingTab = findReusableTab(state, tab);

    if (existingTab) {
      set((state) => {
        // Find the pane containing this tab and activate it
        const pane = findPaneContainingTabRecursive(state.rootPane, existingTab.id);
        if (pane) {
          return {
            rootPane: updatePaneInTree(state.rootPane, pane.id, (p) => ({
              ...(p as TabPane),
              activeTabId: existingTab.id,
            })),
            activeTabHistory: [...state.activeTabHistory.filter((x) => x !== existingTab.id), existingTab.id],
          };
        }
        return {};
      });
      get().saveTabs();
      return existingTab.id;
    }

    const id = generateId();
    const newTab: Tab = { ...tab, id };

    set((state) => {
      // Use provided targetPaneId if valid, otherwise find the first tab pane
      let finalTargetPaneId: string;
      
      if (targetPaneId) {
        // Verify the target pane exists
        const targetPane = findPaneByIdRecursive(state.rootPane, targetPaneId);
        if (targetPane && targetPane.type === "tabs") {
          finalTargetPaneId = targetPaneId;
        } else {
          // Fall back to first pane if target is invalid
          const findFirstTabPane = (p: Pane): TabPane | null => {
            if (p.type === "tabs") return p;
            if (p.type === "split") {
              for (const child of p.children) {
                const found = findFirstTabPane(child);
                if (found) return found;
              }
            }
            return null;
          };
          const firstPane = findFirstTabPane(state.rootPane);
          if (firstPane) {
            finalTargetPaneId = firstPane.id;
          } else {
            const newPane = createTabPane([id], id);
            return {
              tabs: [...state.tabs, newTab],
              rootPane: newPane,
              activeTabHistory: [...state.activeTabHistory.filter((x) => x !== id), id],
            };
          }
        }
      } else {
        // No target provided, find the first tab pane
        const findFirstTabPane = (p: Pane): TabPane | null => {
          if (p.type === "tabs") return p;
          if (p.type === "split") {
            for (const child of p.children) {
              const found = findFirstTabPane(child);
              if (found) return found;
            }
          }
          return null;
        };
        const firstPane = findFirstTabPane(state.rootPane);
        if (firstPane) {
          finalTargetPaneId = firstPane.id;
        } else {
          const newPane = createTabPane([id], id);
          return {
            tabs: [...state.tabs, newTab],
            rootPane: newPane,
            activeTabHistory: [...state.activeTabHistory.filter((x) => x !== id), id],
          };
        }
      }

      return {
        tabs: [...state.tabs, newTab],
        rootPane: updatePaneInTree(state.rootPane, finalTargetPaneId, (p) => ({
          ...(p as TabPane),
          tabIds: [...(p as TabPane).tabIds, id],
          activeTabId: id,
        })),
        activeTabHistory: [...state.activeTabHistory.filter((x) => x !== id), id],
      };
    });

    get().saveTabs();
    return id;
  },

  // Add a new tab in background
  addTabInBackground: (tab, targetPaneId?) => {
    const state = get();
    const existingTab = findReusableTab(state, tab);

    if (existingTab) {
      return existingTab.id;
    }

    const id = generateId();
    const newTab: Tab = { ...tab, id };

    set((state) => {
      // Use provided targetPaneId if valid, otherwise find the first tab pane
      let finalTargetPaneId: string;
      
      if (targetPaneId) {
        // Verify the target pane exists
        const targetPane = findPaneByIdRecursive(state.rootPane, targetPaneId);
        if (targetPane && targetPane.type === "tabs") {
          finalTargetPaneId = targetPaneId;
        } else {
          // Fall back to first pane if target is invalid
          const findFirstTabPane = (p: Pane): TabPane | null => {
            if (p.type === "tabs") return p;
            if (p.type === "split") {
              for (const child of p.children) {
                const found = findFirstTabPane(child);
                if (found) return found;
              }
            }
            return null;
          };
          const firstPane = findFirstTabPane(state.rootPane);
          if (firstPane) {
            finalTargetPaneId = firstPane.id;
          } else {
            const newPane = createTabPane([id], null);
            return {
              tabs: [...state.tabs, newTab],
              rootPane: newPane,
            };
          }
        }
      } else {
        // No target provided, find the first tab pane
        const findFirstTabPane = (p: Pane): TabPane | null => {
          if (p.type === "tabs") return p;
          if (p.type === "split") {
            for (const child of p.children) {
              const found = findFirstTabPane(child);
              if (found) return found;
            }
          }
          return null;
        };
        const firstPane = findFirstTabPane(state.rootPane);
        if (firstPane) {
          finalTargetPaneId = firstPane.id;
        } else {
          const newPane = createTabPane([id], null);
          return {
            tabs: [...state.tabs, newTab],
            rootPane: newPane,
          };
        }
      }

      const targetPane = findPaneByIdRecursive(state.rootPane, finalTargetPaneId) as TabPane;
      return {
        tabs: [...state.tabs, newTab],
        rootPane: updatePaneInTree(state.rootPane, finalTargetPaneId, (p) => ({
          ...(p as TabPane),
          tabIds: [...(p as TabPane).tabIds, id],
          activeTabId: targetPane.activeTabId,
        })),
      };
    });

    get().saveTabs();
    return id;
  },

  // Close a tab
  closeTab: (tabId) => {
    set((state) => {
      const tabToClose = state.tabs.find((t) => t.id === tabId);
      if (tabToClose && !tabToClose.closable) {
        return state;
      }

      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      const closedTabs = tabToClose ? [...state.closedTabs, tabToClose] : state.closedTabs;

      if (newTabs.length === 0) {
        return state;
      }

      // Find and update the pane containing this tab
      const pane = findPaneContainingTabRecursive(state.rootPane, tabId);
      if (!pane) return state;

      const newTabIds = pane.tabIds.filter((id) => id !== tabId);
      let newActiveTabId = pane.activeTabId;

      const newHistory = state.activeTabHistory.filter((x) => x !== tabId);

      if (pane.activeTabId === tabId) {
        let foundPreviousActive = false;
        for (let i = newHistory.length - 1; i >= 0; i--) {
          const candidateId = newHistory[i];
          if (newTabIds.includes(candidateId)) {
            newActiveTabId = candidateId;
            foundPreviousActive = true;
            break;
          }
        }

        if (!foundPreviousActive) {
          const closedIndex = pane.tabIds.findIndex((id) => id === tabId);
          const newIndex = Math.max(0, closedIndex - 1);
          newActiveTabId = newTabIds[newIndex] || null;
        }
      }

      const isLastTabInOnlyPane = newTabIds.length === 0 && 
        state.rootPane.type === "tabs" && 
        state.rootPane.id === pane.id;

      // If pane is empty and it's not the only pane, remove it
      let newRootPane = state.rootPane;
      if (newTabIds.length === 0 && !isLastTabInOnlyPane) {
        newRootPane = removePaneFromTree(state.rootPane, pane.id) || createTabPane();
      } else {
        newRootPane = updatePaneInTree(state.rootPane, pane.id, (p) => ({
          ...(p as TabPane),
          tabIds: newTabIds,
          activeTabId: newActiveTabId,
        }));
      }

      setTimeout(() => get().saveTabs(), 0);

      return {
        tabs: newTabs,
        rootPane: newRootPane,
        closedTabs,
        activeTabHistory: newHistory,
      };
    });
  },

  // Set the active tab in a specific pane
  setActiveTab: (paneId, tabId) => {
    set((state) => ({
      rootPane: updatePaneInTree(state.rootPane, paneId, (p) => ({
        ...(p as TabPane),
        activeTabId: tabId,
      })),
      activeTabHistory: [...state.activeTabHistory.filter((x) => x !== tabId), tabId],
      // A direct navigation invalidates any forward history (browser semantics).
      forwardTabHistory: [],
    }));
    get().saveTabs();
  },

  updateTab: (tabId, updates) => {
    set((state) => {
      const tabs = state.tabs.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab));
      return { tabs };
    });
    get().saveTabs();
  },

  reopenLastClosedTab: () => {
    set((state) => {
      const closedTabs = [...state.closedTabs];
      const lastClosed = closedTabs.pop();
      if (!lastClosed) return state;

      if (state.tabs.some((tab) => tab.id === lastClosed.id)) {
        return { closedTabs };
      }

      // Find first tab pane to add to
      let targetPaneId: string;
      const findFirstTabPane = (p: Pane): TabPane | null => {
        if (p.type === "tabs") return p;
        if (p.type === "split") {
          for (const child of p.children) {
            const found = findFirstTabPane(child);
            if (found) return found;
          }
        }
        return null;
      };
      const firstPane = findFirstTabPane(state.rootPane);
      if (!firstPane) return state;
      targetPaneId = firstPane.id;

      const tabs = [...state.tabs, lastClosed];
      return {
        tabs,
        rootPane: updatePaneInTree(state.rootPane, targetPaneId, (p) => ({
          ...(p as TabPane),
          tabIds: [...(p as TabPane).tabIds, lastClosed.id],
          activeTabId: lastClosed.id,
        })),
        closedTabs,
        activeTabHistory: [...state.activeTabHistory.filter((x) => x !== lastClosed.id), lastClosed.id],
      };
    });
    setTimeout(() => get().saveTabs(), 0);
  },

  // Edge-swipe back: activate the tab visited just before the current one.
  // Pushes the current tab onto forwardTabHistory (so goToNextTab can return).
  // No-ops (returns false) if there's no tab to go back to.
  goToPreviousTab: () => {
    const state = get();
    const history = state.activeTabHistory;
    // History is most-recent-last; the current active tab is the last entry.
    // We need the entry before it that is still open and in the first tab pane
    // (mobile only renders the first tab pane).
    const findFirstTabPane = (p: Pane): TabPane | null => {
      if (p.type === "tabs") return p;
      if (p.type === "split") {
        for (const child of p.children) {
          const found = findFirstTabPane(child);
          if (found) return found;
        }
      }
      return null;
    };
    const firstPane = findFirstTabPane(state.rootPane);
    if (!firstPane) return false;
    const openIds = new Set(firstPane.tabIds);

    if (history.length < 2) return false;

    // Walk back from the end, skipping the current tab, to find a valid target.
    let targetId: string | null = null;
    for (let i = history.length - 2; i >= 0; i--) {
      if (openIds.has(history[i])) {
        targetId = history[i];
        break;
      }
    }
    if (!targetId || targetId === firstPane.activeTabId) return false;

    const currentId = firstPane.activeTabId;
    set((s) => ({
      rootPane: updatePaneInTree(s.rootPane, firstPane.id, (p) => ({
        ...(p as TabPane),
        activeTabId: targetId!,
      })),
      // Move current tab to the forward stack so goToNextTab can retrace it.
      forwardTabHistory: currentId
        ? [...s.forwardTabHistory.filter((x) => x !== currentId), currentId]
        : s.forwardTabHistory,
    }));
    setTimeout(() => get().saveTabs(), 0);
    return true;
  },

  // Edge-swipe forward: retrace a prior "back". Consumes forwardTabHistory.
  // Returns false if there is nowhere to go forward.
  goToNextTab: () => {
    const state = get();
    const findFirstTabPane = (p: Pane): TabPane | null => {
      if (p.type === "tabs") return p;
      if (p.type === "split") {
        for (const child of p.children) {
          const found = findFirstTabPane(child);
          if (found) return found;
        }
      }
      return null;
    };
    const firstPane = findFirstTabPane(state.rootPane);
    if (!firstPane) return false;
    const openIds = new Set(firstPane.tabIds);

    if (state.forwardTabHistory.length === 0) return false;

    let targetId: string | null = null;
    for (let i = state.forwardTabHistory.length - 1; i >= 0; i--) {
      if (openIds.has(state.forwardTabHistory[i])) {
        targetId = state.forwardTabHistory[i];
        break;
      }
    }
    if (!targetId || targetId === firstPane.activeTabId) return false;

    const currentId = firstPane.activeTabId;
    set((s) => ({
      rootPane: updatePaneInTree(s.rootPane, firstPane.id, (p) => ({
        ...(p as TabPane),
        activeTabId: targetId!,
      })),
      // Pop the target off the forward stack; re-add current so a subsequent
      // back/forward ping-pongs correctly.
      forwardTabHistory: currentId
        ? [
            ...s.forwardTabHistory.filter(
              (x) => x !== targetId && x !== currentId
            ),
            currentId,
          ]
        : s.forwardTabHistory.filter((x) => x !== targetId),
    }));
    setTimeout(() => get().saveTabs(), 0);
    return true;
  },

  closeOtherTabs: (tabId) => {
    set((state) => {
      const pane = findPaneContainingTabRecursive(state.rootPane, tabId);
      if (!pane) return state;

      const tabToKeep = state.tabs.find((t) => t.id === tabId);
      if (!tabToKeep) return state;

      const closableTabs = pane.tabIds.filter((id) => {
        const t = state.tabs.find((tab) => tab.id === id);
        return t?.closable && id !== tabId;
      });

      const newClosedTabs = [
        ...state.closedTabs,
        ...state.tabs.filter((t) => closableTabs.includes(t.id)),
      ];

      setTimeout(() => get().saveTabs(), 0);

      return {
        tabs: state.tabs.filter((t) => !closableTabs.includes(t.id)),
        rootPane: updatePaneInTree(state.rootPane, pane.id, (p) => ({
          ...(p as TabPane),
          tabIds: [tabId],
          activeTabId: tabId,
        })),
        closedTabs: newClosedTabs,
        activeTabHistory: [tabId],
      };
    });
  },

  closeTabsToRight: (tabId) => {
    set((state) => {
      const pane = findPaneContainingTabRecursive(state.rootPane, tabId);
      if (!pane) return state;

      const tabIndex = pane.tabIds.findIndex((id) => id === tabId);
      const tabsToClose = pane.tabIds.slice(tabIndex + 1).filter((id) => {
        const t = state.tabs.find((tab) => tab.id === id);
        return t?.closable;
      });

      const newClosedTabs = [
        ...state.closedTabs,
        ...state.tabs.filter((t) => tabsToClose.includes(t.id)),
      ];

      setTimeout(() => get().saveTabs(), 0);

      return {
        tabs: state.tabs.filter((t) => !tabsToClose.includes(t.id)),
        rootPane: updatePaneInTree(state.rootPane, pane.id, (p) => ({
          ...(p as TabPane),
          tabIds: (p as TabPane).tabIds.filter((id) => !tabsToClose.includes(id)),
        })),
        closedTabs: newClosedTabs,
        activeTabHistory: state.activeTabHistory.filter((id) => !tabsToClose.includes(id)),
      };
    });
  },

  closeAllTabs: () => {
    set((state) => {
      const allClosableTabs = state.tabs.filter((t) => t.closable);
      const newClosedTabs = [...state.closedTabs, ...allClosableTabs];

      // Find first non-closable tab to keep
      const firstNonClosable = state.tabs.find((t) => !t.closable);
      
      setTimeout(() => get().saveTabs(), 0);

      if (firstNonClosable) {
        return {
          tabs: [firstNonClosable],
          rootPane: createTabPane([firstNonClosable.id], firstNonClosable.id),
          closedTabs: newClosedTabs,
          activeTabHistory: [firstNonClosable.id],
        };
      }

      return {
        tabs: [],
        rootPane: createTabPane(),
        closedTabs: newClosedTabs,
        activeTabHistory: [],
      };
    });
  },

  moveTab: (fromIndex, toIndex, paneId) => {
    set((state) => {
      if (paneId) {
        // Move within a specific pane
        const pane = findPaneByIdRecursive(state.rootPane, paneId) as TabPane;
        if (!pane) return state;

        const newTabIds = [...pane.tabIds];
        if (fromIndex < 0 || fromIndex >= newTabIds.length) return state;
        if (toIndex < 0 || toIndex >= newTabIds.length) return state;

        const [movedTab] = newTabIds.splice(fromIndex, 1);
        newTabIds.splice(toIndex, 0, movedTab);

        setTimeout(() => get().saveTabs(), 0);

        return {
          rootPane: updatePaneInTree(state.rootPane, paneId, (p) => ({
            ...(p as TabPane),
            tabIds: newTabIds,
          })),
        };
      }
      
      // Legacy: move in global tabs array
      if (fromIndex < 0 || fromIndex >= state.tabs.length) return state;
      if (toIndex < 0 || toIndex >= state.tabs.length) return state;

      const newTabs = [...state.tabs];
      const [movedTab] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, movedTab);

      setTimeout(() => get().saveTabs(), 0);

      return { tabs: newTabs };
    });
  },

  moveTabToPane: (tabId, fromPaneId, toPaneId, targetIndex) => {
    set((state) => {
      const fromPane = findPaneByIdRecursive(state.rootPane, fromPaneId) as TabPane;
      const toPane = findPaneByIdRecursive(state.rootPane, toPaneId) as TabPane;
      
      if (!fromPane || !toPane) return state;

      const newFromTabIds = fromPane.tabIds.filter((id) => id !== tabId);
      let newFromActiveTabId = fromPane.activeTabId;
      if (fromPane.activeTabId === tabId) {
        const idx = fromPane.tabIds.findIndex((id) => id === tabId);
        newFromActiveTabId = newFromTabIds[Math.max(0, idx - 1)] || null;
      }

      // Add to target pane
      const newToTabIds = [...toPane.tabIds];
      const insertIndex = targetIndex !== undefined ? targetIndex : newToTabIds.length;
      newToTabIds.splice(insertIndex, 0, tabId);

      let newRootPane = updatePaneInTree(state.rootPane, fromPaneId, (p) => ({
        ...(p as TabPane),
        tabIds: newFromTabIds,
        activeTabId: newFromActiveTabId,
      }));

      const finalActiveId = toPane.activeTabId || tabId;
      newRootPane = updatePaneInTree(newRootPane, toPaneId, (p) => ({
        ...(p as TabPane),
        tabIds: newToTabIds,
        activeTabId: finalActiveId,
      }));

      const finalPane = findPaneByIdRecursive(newRootPane, fromPaneId) as TabPane;
      if (finalPane && finalPane.tabIds.length === 0) {
        newRootPane = removePaneFromTree(newRootPane, fromPaneId) || createTabPane();
      }

      setTimeout(() => get().saveTabs(), 0);

      const historyWithActives = [...state.activeTabHistory];
      if (newFromActiveTabId) {
        historyWithActives.push(newFromActiveTabId);
      }
      historyWithActives.push(finalActiveId);
      const finalHistory = Array.from(new Set(historyWithActives));

      return {
        rootPane: newRootPane,
        activeTabHistory: finalHistory,
      };
    });
  },

  splitPane: (paneId, tabId, direction, side) => {
    set((state) => {
      const pane = findPaneByIdRecursive(state.rootPane, paneId) as TabPane;
      if (!pane) return state;

      const newPane = createTabPane([tabId], tabId);
      
      const newTabIds = pane.tabIds.filter((id) => id !== tabId);
      const newActiveTabId = pane.activeTabId === tabId 
        ? (newTabIds[0] || null)
        : pane.activeTabId;

      const updatedOriginalPane: TabPane = {
        ...pane,
        tabIds: newTabIds,
        activeTabId: newActiveTabId,
      };

      const children = side === "before" 
        ? [newPane, updatedOriginalPane]
        : [updatedOriginalPane, newPane];
      const sizes = [50, 50];

      const splitPane = createSplitPane(direction, children, sizes);

      // Replace the original pane with the split
      const parent = findParentPane(state.rootPane, paneId);
      let newRootPane: Pane;
      
      if (parent) {
        newRootPane = updatePaneInTree(state.rootPane, parent.id, (p) => {
          const splitParent = p as SplitPane;
          return {
            ...splitParent,
            children: splitParent.children.map((child) =>
              child.id === paneId ? splitPane : child
            ),
          };
        });
      } else {
        newRootPane = splitPane;
      }

      setTimeout(() => get().saveTabs(), 0);

      const historyWithBoth = [...state.activeTabHistory];
      if (newActiveTabId) {
        historyWithBoth.push(newActiveTabId);
      }
      historyWithBoth.push(tabId);
      const finalHistory = Array.from(new Set(historyWithBoth));

      return {
        rootPane: newRootPane,
        activeTabHistory: finalHistory,
      };
    });
  },

  spawnTabInSplit: (paneId, tabId, direction, side) => {
    set((state) => {
      const pane = findPaneByIdRecursive(state.rootPane, paneId) as TabPane;
      if (!pane || pane.type !== "tabs") return state;

      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) return state;

      const newTabId = generateId();
      const clonedTab: Tab = { ...tab, id: newTabId };

      const newPane = createTabPane([newTabId], newTabId);
      const children = side === "before" ? [newPane, pane] : [pane, newPane];
      const splitPane = createSplitPane(direction, children, [50, 50]);

      const parent = findParentPane(state.rootPane, paneId);
      let newRootPane: Pane;
      if (parent) {
        newRootPane = updatePaneInTree(state.rootPane, parent.id, (p) => {
          const splitParent = p as SplitPane;
          return {
            ...splitParent,
            children: splitParent.children.map((child) => (child.id === paneId ? splitPane : child)),
          };
        });
      } else {
        newRootPane = splitPane;
      }

      setTimeout(() => get().saveTabs(), 0);
      return {
        tabs: [...state.tabs, clonedTab],
        rootPane: newRootPane,
        activeTabHistory: [...state.activeTabHistory.filter((x) => x !== newTabId), newTabId],
      };
    });
  },

  moveTabToSplit: (tabId, fromPaneId, targetPaneId, direction, side) => {
    set((state) => {
      const fromPane = findPaneByIdRecursive(state.rootPane, fromPaneId) as TabPane;
      const targetPane = findPaneByIdRecursive(state.rootPane, targetPaneId) as TabPane;
      
      if (!fromPane || !targetPane) return state;

      const newFromTabIds = fromPane.tabIds.filter((id) => id !== tabId);
      const newFromActiveTabId = fromPane.activeTabId === tabId
        ? (newFromTabIds[0] || null)
        : fromPane.activeTabId;

      const newPane = createTabPane([tabId], tabId);

      const children = side === "before"
        ? [newPane, targetPane]
        : [targetPane, newPane];

      const splitPane = createSplitPane(direction, children, [50, 50]);

      let newRootPane = updatePaneInTree(state.rootPane, fromPaneId, (p) => ({
        ...(p as TabPane),
        tabIds: newFromTabIds,
        activeTabId: newFromActiveTabId,
      }));

      // Replace target pane with split
      const parent = findParentPane(newRootPane, targetPaneId);
      if (parent) {
        newRootPane = updatePaneInTree(newRootPane, parent.id, (p) => {
          const splitParent = p as SplitPane;
          return {
            ...splitParent,
            children: splitParent.children.map((child) =>
              child.id === targetPaneId ? splitPane : child
            ),
          };
        });
      } else if (newRootPane.id === targetPaneId) {
        newRootPane = splitPane;
      }

      const finalFromPane = findPaneByIdRecursive(newRootPane, fromPaneId) as TabPane;
      if (finalFromPane && finalFromPane.tabIds.length === 0) {
        newRootPane = removePaneFromTree(newRootPane, fromPaneId) || createTabPane();
      }

      setTimeout(() => get().saveTabs(), 0);

      const historyWithBoth = [...state.activeTabHistory];
      if (newFromActiveTabId) {
        historyWithBoth.push(newFromActiveTabId);
      }
      historyWithBoth.push(tabId);
      const finalHistory = Array.from(new Set(historyWithBoth));

      return {
        rootPane: newRootPane,
        activeTabHistory: finalHistory,
      };
    });
  },

  resizeSplit: (splitPaneId, newSizes) => {
    set((state) => ({
      rootPane: updatePaneInTree(state.rootPane, splitPaneId, (p) => ({
        ...(p as SplitPane),
        sizes: newSizes,
      })),
    }));
    get().saveTabs();
  },

  collapseSplit: (splitPaneId, childPaneId) => {
    set((state) => {
      const splitPane = findPaneByIdRecursive(state.rootPane, splitPaneId) as SplitPane;
      if (!splitPane) return state;

      const childToKeep = splitPane.children.find((c) => c.id !== childPaneId);
      if (!childToKeep) return state;

      const parent = findParentPane(state.rootPane, splitPaneId);
      let newRootPane: Pane;

      if (parent) {
        newRootPane = updatePaneInTree(state.rootPane, parent.id, (p) => {
          const splitParent = p as SplitPane;
          return {
            ...splitParent,
            children: splitParent.children.map((child) =>
              child.id === splitPaneId ? childToKeep : child
            ),
          };
        });
      } else {
        newRootPane = childToKeep;
      }

      setTimeout(() => get().saveTabs(), 0);

      return { rootPane: newRootPane };
    });
  },

  findPaneById: (paneId) => {
    return findPaneByIdRecursive(get().rootPane, paneId);
  },

  findPaneContainingTab: (tabId) => {
    return findPaneContainingTabRecursive(get().rootPane, tabId);
  },

  getAllPaneIds: () => {
    return collectPaneIds(get().rootPane);
  },

  getTabPaneIds: () => {
    return collectTabPaneIds(get().rootPane);
  },

  saveTabs: () => {
    try {
      const state = get();
      const serializableTabs = state.tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        icon: tab.icon,
        type: tab.type,
        closable: tab.closable,
        data: tab.data,
      }));

      // Collect UI state from other stores for session restore
      let uiState: Record<string, unknown> | undefined;
      try {
        const ui = useUIStore.getState();
        const coll = useCollectionStore.getState();
        uiState = {
          sidebarCollapsed: ui.sidebarCollapsed,
          currentView: ui.currentView,
          activeCollectionId: coll.activeCollectionId,
        };
      } catch {
        // Stores may not be available during SSR or tests
      }

      const data = {
        tabs: serializableTabs,
        rootPane: state.rootPane,
        uiState,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save tabs:", error);
    }
  },

  loadTabs: async () => {
    try {
      // Gate on the restoreSession setting
      if (!useSettingsStore.getState().settings.general.restoreSession) return false;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;

      const data = JSON.parse(stored);
      if (!data.tabs || !Array.isArray(data.tabs) || !data.rootPane) return false;

      // Lazy import to avoid circular dep at module load time
      const { rehydrateTab } = await import("../components/tabs/TabRegistry") as {
        rehydrateTab: (s: SerializedTabData) => Tab;
      };

      const validTabIds = new Set<string>();

      // Rehydrate tabs, filtering out invalid ones
      const rehydratedTabs: Tab[] = [];
      for (const serialized of data.tabs) {
        try {
          const tab = rehydrateTab(serialized);
          rehydratedTabs.push(tab);
          validTabIds.add(tab.id);
        } catch {
          console.warn("Failed to rehydrate tab:", serialized.type, serialized.id);
        }
      }

      if (rehydratedTabs.length === 0) return false;

      // Filter pane tree to remove tabs that failed rehydration
      const filteredRootPane = filterInvalidTabsFromPane(data.rootPane, validTabIds);

      const cleanedPane = cleanupEmptyPanes(filteredRootPane);

      // Collect all active tab IDs from restored pane tree to initialize history
      const activeIds: string[] = [];
      const collectActiveTabIds = (p: Pane) => {
        if (p.type === "tabs" && p.activeTabId) {
          activeIds.push(p.activeTabId);
        } else if (p.type === "split") {
          p.children.forEach(collectActiveTabIds);
        }
      };
      collectActiveTabIds(cleanedPane);

      set({
        tabs: rehydratedTabs,
        rootPane: cleanedPane,
        activeTabHistory: activeIds,
      });

      // Restore UI state
      if (data.uiState && typeof data.uiState === "object") {
        const ui = data.uiState as Record<string, unknown>;
        if (typeof ui.sidebarCollapsed === "boolean") {
          useUIStore.getState().setSidebarCollapsed(ui.sidebarCollapsed);
        }
        if (typeof ui.currentView === "string") {
          useUIStore.getState().setCurrentView(ui.currentView as import("../types").ViewName);
        }
        if (typeof ui.activeCollectionId === "string") {
          useCollectionStore.setState({ activeCollectionId: ui.activeCollectionId });
        }
      }
      return true;
    } catch (error) {
      console.error("Failed to load tabs:", error);
      return false;
    }
  },
}));
