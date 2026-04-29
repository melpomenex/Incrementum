import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CardPreviewPanel } from "../CardPreviewPanel";
import type { LearningItem } from "../../../api/learning-items";

// Minimal LearningItem factory
function makeCard(overrides: Partial<LearningItem> = {}): LearningItem {
  return {
    id: "card-1",
    item_type: "Flashcard",
    question: "What is 2+2?",
    answer: "4",
    difficulty: 0.3,
    interval: 7,
    ease_factor: 2.5,
    due_date: "2024-06-20T00:00:00.000Z",
    date_created: "2024-06-01T00:00:00.000Z",
    date_modified: "2024-06-15T00:00:00.000Z",
    review_count: 5,
    lapses: 1,
    state: "Review",
    is_suspended: false,
    tags: ["math", "basic"],
    ...overrides,
  };
}

// Mock renderAnkiHtmlWithLatex to avoid KaTeX in tests
vi.mock("../../../utils/ankiLatex", () => ({
  renderAnkiHtmlWithLatex: (html: string) => html,
}));

// Mock Toast
vi.mock("../../common/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

// Mock i18n
vi.mock("../../../lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
  }),
}));

// Mock API
vi.mock("../../../api/learning-items", () => ({
  updateLearningItemContentWithVersion: vi.fn().mockResolvedValue({}),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CardPreviewPanel", () => {
  it("renders placeholder when no card is selected", () => {
    render(<CardPreviewPanel card={null} />);
    expect(screen.getByText("Select a card to preview")).toBeInTheDocument();
  });

  it("renders Preview tab by default when card is provided", () => {
    const card = makeCard();
    render(<CardPreviewPanel card={card} />);
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("renders question content on Preview tab", () => {
    const card = makeCard({ question: "What is the capital of France?" });
    render(<CardPreviewPanel card={card} />);
    expect(screen.getByText("What is the capital of France?")).toBeInTheDocument();
  });

  it("renders answer content on Preview tab for flashcards", () => {
    const card = makeCard({ question: "Q?", answer: "A!" });
    render(<CardPreviewPanel card={card} />);
    expect(screen.getByText("A!")).toBeInTheDocument();
  });

  it("renders tags", () => {
    const card = makeCard({ tags: ["math", "basic", "review"] });
    render(<CardPreviewPanel card={card} />);
    expect(screen.getByText("math")).toBeInTheDocument();
    expect(screen.getByText("basic")).toBeInTheDocument();
    expect(screen.getByText("review")).toBeInTheDocument();
  });

  it("renders 'Cloze Text' label for cloze cards", () => {
    const card = makeCard({ item_type: "Cloze", question: "", cloze_text: "The capital of {{c1::France}} is Paris." });
    render(<CardPreviewPanel card={card} />);
    expect(screen.getByText("Cloze Text")).toBeInTheDocument();
  });

  it("shows 'No tags' when card has no tags", () => {
    const card = makeCard({ tags: [] });
    render(<CardPreviewPanel card={card} />);
    expect(screen.getByText("No tags")).toBeInTheDocument();
  });

  it("switches to Edit tab on click", () => {
    const card = makeCard();
    render(<CardPreviewPanel card={card} />);
    fireEvent.click(screen.getByText("Edit"));
    // Edit tab should show question textarea (we can check for the section label)
    expect(screen.getAllByText("Question").length).toBeGreaterThan(0);
  });

  it("switches to History tab on click", () => {
    const card = makeCard();
    render(<CardPreviewPanel card={card} />);
    fireEvent.click(screen.getByText("History"));
    // History tab shows review-related info
    expect(screen.getAllByText("Total Reviews").length).toBeGreaterThan(0);
  });

  it("renders review stats on Preview tab", () => {
    const card = makeCard({ review_count: 10, lapses: 2 });
    render(<CardPreviewPanel card={card} />);
    expect(screen.getByText("10 reviews")).toBeInTheDocument();
    expect(screen.getByText("2 lapses")).toBeInTheDocument();
  });
});
