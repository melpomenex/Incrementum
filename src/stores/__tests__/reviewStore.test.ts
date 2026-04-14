import { beforeEach, beforeAll, describe, expect, it, vi } from "vitest";

const {
  submitReviewMock,
  restoreLearningItemStateMock,
  rateDocumentMock,
  restoreDocumentSchedulingMock,
  getDocumentMock,
} = vi.hoisted(() => ({
  submitReviewMock: vi.fn(),
  restoreLearningItemStateMock: vi.fn(),
  rateDocumentMock: vi.fn(),
  restoreDocumentSchedulingMock: vi.fn(),
  getDocumentMock: vi.fn(),
}));

vi.mock("../../api/review", () => ({
  getDueItems: vi.fn().mockResolvedValue([]),
  submitReview: submitReviewMock,
  restoreLearningItemState: restoreLearningItemStateMock,
  previewReviewIntervals: vi.fn().mockResolvedValue({ again: 1, hard: 2, good: 3, easy: 4 }),
  getReviewStreak: vi.fn().mockResolvedValue({
    current_streak: 0,
    longest_streak: 0,
    total_reviews: 0,
  }),
  startReview: vi.fn().mockResolvedValue("session"),
}));

vi.mock("../../api/queue", () => ({
  getDueDocumentsOnly: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/algorithm", () => ({
  rateDocument: rateDocumentMock,
  restoreDocumentScheduling: restoreDocumentSchedulingMock,
}));

vi.mock("../../api/documents", () => ({
  getDocument: getDocumentMock,
}));

vi.mock("../collectionStore", () => ({
  useCollectionStore: {
    getState: () => ({
      activeCollectionId: null,
      documentAssignments: {},
    }),
  },
}));

vi.mock("../studyDeckStore", () => ({
  useStudyDeckStore: {
    getState: () => ({
      activeDeckIds: [],
      decks: [],
    }),
  },
}));

vi.mock("../settingsStore", () => ({
  useSettingsStore: {
    getState: () => ({
      settings: {
        learning: {
          fsrsParams: { desiredRetention: 0.9, maximumInterval: 36500 },
          scopedFsrsOverrides: [],
        },
      },
    }),
  },
}));

vi.mock("../../lib/sync-client", () => ({
  getUser: vi.fn(() => null),
}));

import { useReviewStore } from "../reviewStore";

beforeAll(() => {
  const data = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
});

const makeLearningCard = (overrides: Partial<any> = {}) => ({
  id: "card-1",
  item_type: "flashcard" as const,
  question: "Q",
  answer: "A",
  difficulty: 3,
  interval: 2,
  ease_factor: 2.5,
  due_date: new Date().toISOString(),
  date_created: new Date().toISOString(),
  date_modified: new Date().toISOString(),
  review_count: 2,
  lapses: 0,
  state: "review" as const,
  is_suspended: false,
  tags: ["biology"],
  extract_id: "extract-1",
  ...overrides,
});

describe("reviewStore Wave 1 behavior", () => {
  beforeEach(() => {
    submitReviewMock.mockReset();
    restoreLearningItemStateMock.mockReset();
    rateDocumentMock.mockReset();
    restoreDocumentSchedulingMock.mockReset();
    getDocumentMock.mockReset();
    window.localStorage.clear();
    useReviewStore.getState().resetSession();
  });

  it("does not mutate scheduling in cram mode", async () => {
    const card = makeLearningCard();
    useReviewStore.setState({
      queue: [card],
      currentCard: card,
      currentIndex: 0,
      reviewMode: "cram",
      sessionStartTime: Date.now() - 1000,
      sessionId: "s1",
    });

    await useReviewStore.getState().submitRating(3);

    expect(submitReviewMock).not.toHaveBeenCalled();
    expect(rateDocumentMock).not.toHaveBeenCalled();
  });

  it("undo restores document scheduling and queue state", async () => {
    const docItem = {
      id: "doc:doc-1",
      itemType: "document" as const,
      documentId: "doc-1",
      documentTitle: "Doc",
      tags: [],
    };

    getDocumentMock.mockResolvedValue({
      id: "doc-1",
      title: "Doc",
      filePath: "/tmp/doc.pdf",
      fileType: "pdf",
      tags: [],
      dateAdded: new Date().toISOString(),
      dateModified: new Date().toISOString(),
      extractCount: 0,
      learningItemCount: 0,
      priorityRating: 0,
      prioritySlider: 50,
      priorityScore: 0,
      isArchived: false,
      isFavorite: false,
      nextReadingDate: "2026-03-15T00:00:00.000Z",
      stability: 10,
      difficulty: 4,
      reps: 5,
      totalTimeSpent: 120,
      consecutiveCount: 2,
      dateLastReviewed: "2026-02-28T00:00:00.000Z",
    });
    rateDocumentMock.mockResolvedValue({});
    restoreDocumentSchedulingMock.mockResolvedValue(undefined);

    useReviewStore.setState({
      queue: [docItem],
      currentCard: docItem,
      currentIndex: 0,
      reviewMode: "normal",
      sessionStartTime: Date.now() - 1000,
      sessionId: "s1",
    });

    await useReviewStore.getState().submitRating(3);
    expect(rateDocumentMock).toHaveBeenCalledWith("doc-1", 3, expect.any(Number));

    await useReviewStore.getState().undoLastReview();

    expect(restoreDocumentSchedulingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: "doc-1",
        next_reading_date: "2026-03-15T00:00:00.000Z",
        stability: 10,
        difficulty: 4,
        reps: 5,
        total_time_spent: 120,
        consecutive_count: 2,
      })
    );
    expect(useReviewStore.getState().queue).toHaveLength(1);
    expect(useReviewStore.getState().currentCard?.id).toBe("doc:doc-1");
    expect(useReviewStore.getState().canUndoLastReview).toBe(false);
  });

  it("buries sibling cards from the same extract in the active session", async () => {
    submitReviewMock.mockResolvedValue({});
    const first = makeLearningCard({ id: "card-1", extract_id: "extract-a" });
    const sibling = makeLearningCard({ id: "card-2", extract_id: "extract-a" });
    const other = makeLearningCard({ id: "card-3", extract_id: "extract-b" });

    useReviewStore.setState({
      queue: [first, sibling, other],
      currentCard: first,
      currentIndex: 0,
      reviewMode: "normal",
      sessionStartTime: Date.now() - 1000,
      sessionId: "s1",
    });

    await useReviewStore.getState().submitRating(3);

    const remainingIds = useReviewStore.getState().queue.map((item) => item.id);
    expect(remainingIds).toEqual(["card-3"]);
  });

  it("records per-review metadata payloads", async () => {
    submitReviewMock.mockResolvedValue({});
    const card = makeLearningCard();
    useReviewStore.setState({
      queue: [card],
      currentCard: card,
      currentIndex: 0,
      reviewMode: "normal",
      sessionStartTime: Date.now() - 1000,
      sessionId: "s1",
    });

    useReviewStore.getState().setPendingReviewMetadata({
      hintsUsed: 2,
      typedMode: "fuzzy",
      typedCorrect: true,
      typedSimilarity: 0.91,
    });

    await useReviewStore.getState().submitRating(4);
    const last = useReviewStore.getState().reviewEventLog.at(-1);
    expect(last?.metadata).toEqual({
      hintsUsed: 2,
      typedMode: "fuzzy",
      typedCorrect: true,
      typedSimilarity: 0.91,
    });
  });
});
