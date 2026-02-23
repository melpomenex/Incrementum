import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewQueueView } from "../ReviewQueueView";
import type { QueueItem } from "../../../types/queue";

const mockStore = vi.hoisted(() => ({
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
  setSearchQuery: vi.fn(),
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
}));

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
