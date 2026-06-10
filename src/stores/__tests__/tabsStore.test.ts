import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

vi.mock("../uiStore", () => ({
  useUIStore: {
    getState: () => ({
      setSidebarCollapsed: vi.fn(),
      setCurrentView: vi.fn(),
    }),
  },
}));

vi.mock("../collectionStore", () => ({
  useCollectionStore: {
    getState: () => ({
      activeCollectionId: null,
    }),
    setState: vi.fn(),
  },
}));

vi.mock("../settingsStore", () => ({
  useSettingsStore: {
    getState: () => ({
      settings: {
        general: {
          restoreSession: true,
        },
      },
    }),
  },
}));

import { useTabsStore, createTabPane } from "../tabsStore";

const DummyComponent = () => null;

describe("tabsStore activeTabHistory and MRU close behavior", () => {
  beforeEach(() => {
    // Reset state before each test
    const initialPane = createTabPane([], null);
    useTabsStore.setState({
      tabs: [],
      rootPane: initialPane,
      closedTabs: [],
      activeTabHistory: [],
    });
  });

  it("maintains activeTabHistory correctly on addTab and setActiveTab", () => {
    const store = useTabsStore.getState();

    // Add Tab A
    const idA = store.addTab({
      title: "Tab A",
      icon: "icon-a" as any,
      type: "documents",
      content: DummyComponent as any,
      closable: true,
    });

    // Add Tab B
    const idB = store.addTab({
      title: "Tab B",
      icon: "icon-b" as any,
      type: "queue",
      content: DummyComponent as any,
      closable: true,
    });

    // Add Tab C
    const idC = store.addTab({
      title: "Tab C",
      icon: "icon-c" as any,
      type: "analytics",
      content: DummyComponent as any,
      closable: true,
    });

    // Current state check: since tabs were added in sequence (which auto-activates them),
    // history should end with C.
    let state = useTabsStore.getState();
    expect(state.activeTabHistory).toEqual([idA, idB, idC]);

    // Activate B
    const paneId = state.rootPane.id;
    useTabsStore.getState().setActiveTab(paneId, idB);

    state = useTabsStore.getState();
    // B should move to the end of history
    expect(state.activeTabHistory).toEqual([idA, idC, idB]);
  });

  it("selects the most recently active tab (MRU) on closeTab", () => {
    const store = useTabsStore.getState();

    // Add A, B, C
    const idA = store.addTab({ title: "Tab A", icon: "icon" as any, type: "documents", content: DummyComponent, closable: true });
    const idB = store.addTab({ title: "Tab B", icon: "icon" as any, type: "queue", content: DummyComponent, closable: true });
    const idC = store.addTab({ title: "Tab C", icon: "icon" as any, type: "analytics", content: DummyComponent, closable: true });

    // Set active sequence: A -> B -> C -> B
    const paneId = useTabsStore.getState().rootPane.id;
    useTabsStore.getState().setActiveTab(paneId, idC);
    useTabsStore.getState().setActiveTab(paneId, idB);

    let state = useTabsStore.getState();
    expect(state.activeTabHistory).toEqual([idA, idC, idB]);
    expect((state.rootPane as any).activeTabId).toBe(idB);

    // Close active tab B
    useTabsStore.getState().closeTab(idB);

    state = useTabsStore.getState();
    // B should be removed from tabs and history
    expect(state.tabs.map(t => t.id)).toEqual([idA, idC]);
    expect(state.activeTabHistory).toEqual([idA, idC]);
    
    // The active tab should switch to C (the most recently active remaining tab)
    // instead of A (which would be index-1 of B).
    expect((state.rootPane as any).activeTabId).toBe(idC);
  });
});
