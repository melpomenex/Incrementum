import type { ViewState } from "./readerPosition";
import type { SelectionContext } from "./selection";

// Document types matching the C++ schema
export interface Document {
  id: string;
  title: string;
  filePath: string;
  fileType: "pdf" | "epub" | "markdown" | "html" | "youtube" | "audio" | "video" | "other";
  content?: string;  // Extracted text content
  contentHash?: string;
  /**
   * Sync manifest identifier for this document's binary file. Set when the
   * document is imported on a device with sync enabled (see documentStore
   * `registerImportedFileSync`), so other devices in the same sync room can
   * discover + pull the file via the FileManifest / FileTransferManager.
   * Absent on documents created before file sync, or when sync is disabled.
   * This is metadata only — it rides the state-sync (localStorage bridge),
   * not the Rust/SQLite schema.
   */
  fileId?: string;
  totalPages?: number;
  currentPage?: number;
  currentScrollPercent?: number;
  currentCfi?: string;
  currentViewState?: ViewState | string;
  positionJson?: string;
  progressPercent?: number;
  category?: string;
  tags: string[];
  dateAdded: string;
  dateModified: string;
  dateLastReviewed?: string;
  extractCount: number;
  learningItemCount: number;
  priorityRating: number;
  prioritySlider: number;
  priorityScore: number;
  isArchived: boolean;
  isFavorite: boolean;
  isDismissed?: boolean;
  metadata?: DocumentMetadata;
  coverImageUrl?: string;
  coverImageSource?: string;
  nextReadingDate?: string;
  readingCount?: number;
  stability?: number;
  difficulty?: number;
  reps?: number;
  totalTimeSpent?: number;
  consecutiveCount?: number;
  collectionId?: string;
}

export interface DocumentMetadata {
  author?: string;
  subject?: string;
  keywords?: string[];
  createdAt?: string;
  modifiedAt?: string;
  fileSize?: number;
  language?: string;
  pageCount?: number;
  wordCount?: number;
  collectionId?: string;
  // Web import metadata
  source?: string;
  fetchedAt?: string;
  siteName?: string;
  image?: string;
  favicon?: string;
  fetchMethod?: 'direct' | 'proxy';
  readingTime?: number;
  browserImportMode?: 'text-editor' | 'rich-preview';
  articleHtml?: string;
  extractedImages?: Array<{
    src: string;
    alt?: string;
  }>;
  // ArXiv metadata
  arxivId?: string;
  arxivUrl?: string;
  pdfUrl?: string;
  htmlUrl?: string;
  originalFileName?: string;
  // Markdown bundle metadata
  bundleImages?: Record<string, string>; // relative path -> stored filename
  hasBundleImages?: boolean;

  // Virtual & Physical Chunking fields
  parentDocumentId?: string;
  chunkIndex?: number;
  totalChunks?: number;
  chunkStartPage?: number;
  chunkEndPage?: number;
  chunkStartSpineIndex?: number;
  chunkEndSpineIndex?: number;
  chunkStartPos?: number;
  chunkEndPos?: number;
  estimatedReadingTimeMins?: number;
}

export interface Extract {
  id: string;
  documentId: string;
  content: string;
  pageTitle?: string;
  pageNumber?: number;
  selectionContext?: SelectionContext;
  highlightColor?: string;
  notes?: string;
  progressiveDisclosureLevel: number;
  maxDisclosureLevel: number;
  dateCreated: string;
  dateModified: string;
  tags: string[];
  category?: string;
  learningItems: LearningItem[];
}

export interface LearningItem {
  id: string;
  extractId?: string;
  documentId?: string;
  itemType: "flashcard" | "cloze" | "qa" | "basic";
  question: string;
  answer?: string;
  clozeText?: string;
  clozeRanges?: [number, number][];
  difficulty: 1 | 2 | 3 | 4 | 5;
  interval: number;
  easeFactor: number;
  dueDate: string;
  dateCreated: string;
  dateModified: string;
  lastReviewDate?: string;
  reviewCount: number;
  lapses: number;
  state: "new" | "learning" | "review" | "relearning";
  isSuspended: boolean;
  tags: string[];
  imageAssetIds?: string[];
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  color?: string;
  icon?: string;
  description?: string;
  dateCreated: string;
  dateModified: string;
  documentCount: number;
  children?: Category[];
}

export interface Annotation {
  id: string;
  documentId: string;
  type: "highlight" | "underline" | "strikeout" | "comment" | "bookmark";
  pageNumber: number;
  content?: string;
  rect?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  color: string;
  dateCreated: string;
  dateModified: string;
}
