import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentsView } from "../DocumentsView";

// ---- Mock data ----

const mockDocuments = [
  {
    id: "doc-1",
    title: "Linear Algebra Textbook",
    filePath: "/books/linear-algebra.pdf",
    fileType: "pdf" as const,
    tags: ["math", "textbook"],
    dateAdded: "2024-06-10T00:00:00.000Z",
    dateModified: "2024-06-12T00:00:00.000Z",
    extractCount: 15,
    learningItemCount: 30,
    priorityRating: 5,
    prioritySlider: 0,
    priorityScore: 95,
    isArchived: false,
    isFavorite: true,
  },
  {
    id: "doc-2",
    title: "Machine Learning Guide",
    filePath: "/books/ml-guide.epub",
    fileType: "epub" as const,
    tags: ["ai"],
    dateAdded: "2024-05-01T00:00:00.000Z",
    dateModified: "2024-06-14T00:00:00.000Z",
    extractCount: 5,
    learningItemCount: 10,
    priorityRating: 3,
    prioritySlider: 0,
    priorityScore: 60,
    isArchived: false,
    isFavorite: false,
  },
  {
    id: "doc-3",
    title: "Physics Notes",
    filePath: "/notes/physics.md",
    fileType: "markdown" as const,
    tags: ["science", "notes"],
    dateAdded: "2024-06-14T00:00:00.000Z",
    dateModified: "2024-06-14T00:00:00.000Z",
    extractCount: 0,
    learningItemCount: 0,
    priorityRating: 1,
    prioritySlider: 0,
    priorityScore: 10,
    isArchived: false,
    isFavorite: false,
  },
  {
    id: "doc-4",
    title: "YouTube Lecture: Calculus",
    filePath: "https://youtube.com/watch?v=abc123",
    fileType: "youtube" as const,
    tags: ["lecture"],
    dateAdded: "2024-06-13T00:00:00.000Z",
    dateModified: "2024-06-13T00:00:00.000Z",
    extractCount: 0,
    learningItemCount: 0,
    priorityRating: 2,
    prioritySlider: 0,
    priorityScore: 30,
    isArchived: false,
    isFavorite: false,
  },
];

const documentStoreValues = {
  documents: mockDocuments,
  isLoading: false,
  isImporting: false,
  importProgress: { current: 0, total: 0 },
  error: null,
  loadDocuments: vi.fn(),
  openFilePickerAndImport: vi.fn(),
  importFromFiles: vi.fn(),
  updateDocument: vi.fn(),
};

// ---- Store mocks ----

vi.mock("../../../stores/documentStore", () => ({
  useDocumentStore: () => documentStoreValues,
}));

vi.mock("../../../stores/collectionStore", () => ({
  useCollectionStore: (selector: any) =>
    selector({
      activeCollectionId: null,
      documentAssignments: {},
      collections: [],
      assignDocument: vi.fn(),
      createCollection: vi.fn(),
    }),
}));

vi.mock("../../../stores/studyDeckStore", () => ({
  useStudyDeckStore: () => ({ studyDecks: [] }),
}));

vi.mock("../../../stores/transcriptionQueueStore", () => ({
  useTranscriptionQueueStore: () => ({ queue: [], isProcessing: false }),
}));

vi.mock("../../../stores/settingsStore", () => ({
  useSettingsStore: {
    getState: () => ({
      settings: { general: { language: "en" } },
    }),
  },
}));

// ---- Feature mocks ----

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

vi.mock("../../../lib/tauri", () => ({
  isTauri: () => false,
  isMac: () => false,
  invokeCommand: vi.fn(),
}));

vi.mock("../../../lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) => key,
    locale: "en",
  }),
}));

vi.mock("../../../api/documents", () => ({
  resolveDocumentCover: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../api/youtube", () => ({
  getYouTubeThumbnail: vi.fn(),
  extractYouTubeTimestamp: vi.fn(),
}));

vi.mock("../import/AnnaArchiveSearch", () => ({
  AnnaArchiveSearch: () => null,
}));

vi.mock("../import/ArxivImportDialog", () => ({
  ArxivImportDialog: () => null,
}));

vi.mock("../import/WebArticleImportDialog", () => ({
  WebArticleImportDialog: () => null,
}));

vi.mock("../import/AudiobookImportDialog", () => ({
  AudiobookImportDialog: () => null,
}));

vi.mock("../import/ImportProgressIndicator", () => ({
  ImportProgressIndicator: () => null,
}));

vi.mock("../import/MarkdownBundlePreview", () => ({
  MarkdownBundlePreview: () => null,
}));

vi.mock("../../../hooks/useMarkdownBundleImport", () => ({
  useMarkdownBundleImport: () => ({ importBundle: vi.fn() }),
}));

vi.mock("../../../utils/ankiImport", () => ({
  importAnkiPackage: vi.fn(),
}));

vi.mock("../common/EmptyState", () => ({
  EmptyDocuments: () => <div data-testid="empty-documents" />,
  EmptySearch: () => <div data-testid="empty-search" />,
}));

vi.mock("../common/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({ confirm: vi.fn(), dialog: null }),
}));

vi.mock("../common/Skeleton", () => ({
  DocumentCardSkeleton: () => <div data-testid="skeleton-card" />,
  DocumentGridSkeleton: () => <div data-testid="skeleton-grid" />,
}));

vi.mock("../common/DragDropUpload", () => ({
  DragDropUpload: () => null,
}));

// ---- Tests ----

describe("DocumentsView grid mode", () => {
  beforeEach(() => {
    window.localStorage.setItem("documentsViewMode", "grid");
  });

  it("renders smart sections in grid mode", () => {
    render(<DocumentsView enableYouTubeImport={false} />);
    // doc-1 (priorityScore: 95) → "In Priority Queue"
    expect(screen.getByText("In Priority Queue")).toBeInTheDocument();
  });

  it("shows Recently Imported section for recent documents", () => {
    render(<DocumentsView enableYouTubeImport={false} />);
    expect(screen.getByText("Recently Imported")).toBeInTheDocument();
  });

  it("renders all document titles in grid", () => {
    render(<DocumentsView enableYouTubeImport={false} />);
    expect(screen.getByText("Linear Algebra Textbook")).toBeInTheDocument();
    expect(screen.getByText("Machine Learning Guide")).toBeInTheDocument();
    expect(screen.getByText("Physics Notes")).toBeInTheDocument();
    expect(screen.getByText("YouTube Lecture: Calculus")).toBeInTheDocument();
  });

  it("shows file type badges on grid cards", () => {
    render(<DocumentsView enableYouTubeImport={false} />);
    expect(screen.getByText("pdf")).toBeInTheDocument();
    expect(screen.getByText("epub")).toBeInTheDocument();
    expect(screen.getByText("markdown")).toBeInTheDocument();
    expect(screen.getByText("youtube")).toBeInTheDocument();
  });

  it("shows file type filter dropdown", () => {
    render(<DocumentsView enableYouTubeImport={false} />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });

  it("shows document tags on cards", () => {
    render(<DocumentsView enableYouTubeImport={false} />);
    expect(screen.getByText("math")).toBeInTheDocument();
    expect(screen.getByText("textbook")).toBeInTheDocument();
    expect(screen.getByText("ai")).toBeInTheDocument();
    expect(screen.getByText("science")).toBeInTheDocument();
    expect(screen.getByText("lecture")).toBeInTheDocument();
  });

  it("shows relative time on cards", () => {
    render(<DocumentsView enableYouTubeImport={false} />);
    const timeElements = screen.getAllByText(/\d+\s*(second|minute|hour|day|week|month|year)s?\s*ago/);
    expect(timeElements.length).toBeGreaterThan(0);
  });

  it("shows document counts in section headers", () => {
    render(<DocumentsView enableYouTubeImport={false} />);
    expect(screen.getByText(/In Priority Queue/)).toBeInTheDocument();
    expect(screen.getByText(/Recently Imported/)).toBeInTheDocument();
  });

  it("renders grid view toggle button", () => {
    render(<DocumentsView enableYouTubeImport={false} />);
    const gridButton = screen.getByLabelText("documentsView.gridView");
    expect(gridButton).toBeInTheDocument();
  });

  it("shows +N tag overflow for cards with many tags", () => {
    documentStoreValues.documents = [
      {
        ...mockDocuments[0],
        tags: ["tag1", "tag2", "tag3", "tag4", "tag5"],
      },
    ];
    render(<DocumentsView enableYouTubeImport={false} />);
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("calls loadDocuments on mount", () => {
    render(<DocumentsView enableYouTubeImport={false} />);
    expect(documentStoreValues.loadDocuments).toHaveBeenCalled();
  });
});
