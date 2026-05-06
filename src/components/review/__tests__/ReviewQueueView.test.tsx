import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ReviewQueueView } from "../ReviewQueueView";
import type { QueueItem } from "../../../types/queue";

const mockStore = vi.hoisted(() => {
  const store: Record<string, any> = {
    items: [
      {
        id: "item-1",
        documentId: "doc-1",
        documentTitle: "Reading Item",
        itemType: "document",
        priority: 7,
        estimatedTime: 5,
        tags: ["History"],
        progress: 20,
      },
      {
        id: "item-3",
        documentId: "doc-3",
        documentTitle: "Second Reading Item",
        itemType: "document",
        priority: 6,
        estimatedTime: 7,
        tags: ["Math"],
        progress: 10,
      },
      {
        id: "item-2",
        documentId: "doc-2",
        documentTitle: "Review Item",
        itemType: "learning-item",
        priority: 9,
        estimatedTime: 2,
        tags: ["Science"],
        progress: 40,
      },
    ] as QueueItem[],
    isLoading: false,
    error: null,
    searchQuery: "",
    setSearchQuery: vi.fn((q: string) => { store.searchQuery = q; }),
    loadQueue: vi.fn(),
    loadStats: vi.fn(),
    selectedIds: new Set<string>(),
    setSelected: vi.fn(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    bulkSuspend: vi.fn(),
    bulkUnsuspend: vi.fn(),
    bulkDelete: vi.fn(),
    bulkOperationLoading: false,
    bulkOperationResult: null,
    clearBulkResult: vi.fn(),
  };
  return store;
});

vi.mock("../../../stores/queueStore", () => ({
  useQueueStore: () => mockStore,
}));

vi.mock("../../../lib/pwa", () => ({
  getDeviceInfo: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isPWA: false,
    isOnline: true,
    pixelRatio: 1,
    screenWidth: 1200,
    screenHeight: 800,
  }),
}));

beforeEach(() => {
  mockStore.loadQueue.mockClear();
  mockStore.loadStats.mockClear();
  mockStore.searchQuery = "";
});

describe("ReviewQueueView", () => {
  it("renders session actions and queue toggle", () => {
    render(<ReviewQueueView />);
    expect(screen.getByText("Start Optimal Session")).toBeInTheDocument();
    expect(screen.getAllByText("Reading Queue").length).toBeGreaterThan(0);
  });

  it("shows inspector for selected item", () => {
    render(<ReviewQueueView />);
    fireEvent.click(screen.getAllByText("Reading Item")[0]);
    expect(screen.getByText("Inspector")).toBeInTheDocument();
    expect(screen.getAllByText("Reading Item").length).toBeGreaterThan(0);
  });

  it("routes optimal session to scroll mode when available", () => {
    const onOpenScrollMode = vi.fn();
    render(<ReviewQueueView onOpenScrollMode={onOpenScrollMode} />);
    fireEvent.click(screen.getByText("Start Optimal Session"));
    expect(onOpenScrollMode).toHaveBeenCalledTimes(1);
  });

  it("supports manual browse keyboard navigation and activation", () => {
    const onOpenDocument = vi.fn();
    render(<ReviewQueueView onOpenDocument={onOpenDocument} />);

    fireEvent.click(screen.getByRole("button", { name: "Manual Browse" }));
    const list = screen.getByLabelText("Queue items list");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("button", { name: "Open Selected" }));

    expect(onOpenDocument).toHaveBeenCalledTimes(1);
    expect(onOpenDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: "item-3", documentId: "doc-3" })
    );
  });
});

describe("Session customization filtering", () => {
  const openModal = () => {
    fireEvent.click(screen.getByRole("button", { name: /Customize Session/i }));
  };

  const findModal = () => {
    // The modal title heading is h2 "Customize Session", the button is a <button>
    return screen.getByRole("heading", { name: "Customize Session", level: 2 }).closest(".fixed")!;
  };

  it("filters visible items by tag when tag selected in customize modal", () => {
    render(<ReviewQueueView />);

    // Both documents should be visible initially (reading mode shows documents)
    expect(screen.getAllByText("Reading Item").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Second Reading Item").length).toBeGreaterThan(0);

    // Open customize session modal
    openModal();

    // Click the "History" tag in the modal
    const modal = findModal() as HTMLElement;
    const historyTag = within(modal).getByText("History");
    fireEvent.click(historyTag);

    // Apply the customization
    fireEvent.click(within(modal).getByText("Apply Customization"));

    // Only "Reading Item" (tagged "History") should remain visible
    expect(screen.queryByText("Second Reading Item")).not.toBeInTheDocument();
    expect(screen.getAllByText("Reading Item").length).toBeGreaterThan(0);
  });

  it("filters visible items by category when category selected", () => {
    // Add category to mock items
    mockStore.items[0] = { ...mockStore.items[0], category: "Chapter 1" };
    mockStore.items[1] = { ...mockStore.items[1], category: "Chapter 2" };

    render(<ReviewQueueView />);

    expect(screen.getAllByText("Reading Item").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Second Reading Item").length).toBeGreaterThan(0);

    // Open modal and select "Chapter 1"
    openModal();
    const modal = findModal() as HTMLElement;
    const chapterButton = within(modal).getByText("Chapter 1");
    fireEvent.click(chapterButton);

    fireEvent.click(within(modal).getByText("Apply Customization"));

    // Only item with category "Chapter 1" should be visible
    expect(screen.queryByText("Second Reading Item")).not.toBeInTheDocument();
    expect(screen.getAllByText("Reading Item").length).toBeGreaterThan(0);
  });

  it("composes tag filter with queue mode (reading mode shows documents with matching tags)", () => {
    render(<ReviewQueueView />);

    openModal();
    const modal = findModal() as HTMLElement;
    const mathTag = within(modal).getByText("Math");
    fireEvent.click(mathTag);
    fireEvent.click(within(modal).getByText("Apply Customization"));

    // Only "Second Reading Item" (tagged "Math") should be visible
    expect(screen.queryByText("Reading Item")).not.toBeInTheDocument();
    expect(screen.getAllByText("Second Reading Item").length).toBeGreaterThan(0);
  });

  it("composes session customization filters with search query", () => {
    // Pre-set search query in the mock store before rendering
    mockStore.searchQuery = "Second";

    render(<ReviewQueueView />);

    // Only "Second Reading Item" should match the search query
    expect(screen.queryByText("Reading Item")).not.toBeInTheDocument();
    expect(screen.getAllByText("Second Reading Item").length).toBeGreaterThan(0);

    // Now apply a tag filter that excludes the matching item
    openModal();
    const modal = findModal() as HTMLElement;
    const historyTag = within(modal).getByText("History");
    fireEvent.click(historyTag);
    fireEvent.click(within(modal).getByText("Apply Customization"));

    // "Second Reading Item" doesn't have "History" tag, so queue should be empty
    expect(screen.queryByText("Second Reading Item")).not.toBeInTheDocument();
    expect(screen.queryByText("Reading Item")).not.toBeInTheDocument();
  });
});
