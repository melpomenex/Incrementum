import { invokeCommand } from "../lib/tauri";
import type { SelectionContext } from "../types/selection";

export interface Extract {
  id: string;
  document_id: string;
  /** Plain text content for search and AI processing */
  content: string;
  /** Rich HTML content with inline styles for 1:1 visual fidelity */
  html_content?: string;
  /** Source URL for web extracts */
  source_url?: string;
  page_title?: string;
  page_number?: number;
  selection_context?: SelectionContext;
  highlight_color?: string;
  notes?: string;
  progressive_disclosure_level: number;
  max_disclosure_level: number;
  progressive_summaries?: Array<{
    level: number;
    summary: string;
    word_count: number;
  }>;
  date_created: string;
  date_modified: string;
  tags: string[];
  category?: string;
  next_review_date?: string;
  last_review_date?: string;
  review_count: number;
  reps: number;
  memory_state?: {
    stability: number;
    difficulty: number;
  };
  /** Inherited priority score (0–100) from the parent document. */
  priority_score?: number;
  /** Dismissed extracts leave the review queue but remain in the library. */
  is_dismissed?: boolean;
}

export interface CreateExtractInput {
  document_id: string;
  content: string;
  /** Rich HTML content with inline styles for 1:1 visual fidelity */
  html_content?: string;
  /** Source URL for web extracts */
  source_url?: string;
  note?: string;
  tags?: string[];
  category?: string;
  color?: string;
  page_number?: number;
  selection_context?: SelectionContext | Record<string, unknown>;
  max_disclosure_level?: number;
}

export interface UpdateExtractInput {
  id: string;
  content?: string;
  note?: string;
  tags?: string[];
  category?: string;
  color?: string;
  max_disclosure_level?: number;
}

function normalizeExtract(extract: Extract): Extract {
  return {
    ...extract,
    content: extract.content ?? "",
    notes: extract.notes ?? "",
    tags: Array.isArray(extract.tags) ? extract.tags : [],
    progressive_disclosure_level: extract.progressive_disclosure_level ?? 0,
    max_disclosure_level: extract.max_disclosure_level ?? 0,
    progressive_summaries: Array.isArray(extract.progressive_summaries) ? extract.progressive_summaries : [],
    review_count: extract.review_count ?? 0,
    reps: extract.reps ?? 0,
  };
}

/**
 * Get all extracts for a document, or all extracts if no documentId is provided
 */
export async function getExtracts(documentId?: string | null): Promise<Extract[]> {
  const extracts = await invokeCommand<Extract[]>("get_extracts", { documentId });
  return Array.isArray(extracts) ? extracts.map(normalizeExtract) : [];
}

/**
 * Get a single extract by ID
 */
export async function getExtract(id: string): Promise<Extract | null> {
  const extract = await invokeCommand<Extract | null>("get_extract", { id });
  return extract ? normalizeExtract(extract) : null;
}

/**
 * Create a new extract
 */
export async function createExtract(input: CreateExtractInput): Promise<Extract> {
  const extract = await invokeCommand<Extract>("create_extract", {
    documentId: input.document_id,
    content: input.content,
    htmlContent: input.html_content,
    sourceUrl: input.source_url,
    note: input.note,
    tags: input.tags,
    category: input.category,
    color: input.color,
    pageNumber: input.page_number,
    selectionContext: input.selection_context,
    maxDisclosureLevel: input.max_disclosure_level,
  });
  return normalizeExtract(extract);
}

/**
 * Update an existing extract
 */
export async function updateExtract(input: UpdateExtractInput): Promise<Extract> {
  const extract = await invokeCommand<Extract>("update_extract", {
    id: input.id,
    content: input.content,
    note: input.note,
    tags: input.tags,
    category: input.category,
    color: input.color,
    maxDisclosureLevel: input.max_disclosure_level,
  });
  return normalizeExtract(extract);
}

/**
 * Delete an extract
 */
export async function deleteExtract(id: string): Promise<void> {
  await invokeCommand("delete_extract", { id });
}

// ---------------------------------------------------------------------------
// Extract lifecycle actions (SuperMemo-style Forget / Dismiss / Done)
// ---------------------------------------------------------------------------

/**
 * Forget an extract: reset its memory state and return it to the new queue.
 */
export async function forgetExtract(id: string): Promise<void> {
  await invokeCommand("forget_extract", { extractId: id, extract_id: id });
}

/**
 * Dismiss (or undismiss) an extract: removes it from the review queue without
 * deleting it. Defaults to dismissed=true when omitted.
 */
export async function dismissExtract(id: string, dismissed?: boolean): Promise<void> {
  await invokeCommand("dismiss_extract", {
    extractId: id,
    extract_id: id,
    dismissed: dismissed ?? true,
  });
}

/**
 * Graduate an extract: schedule it ~5 years in the future with high stability.
 */
export async function graduateExtract(id: string): Promise<void> {
  await invokeCommand("graduate_extract", { extractId: id, extract_id: id });
}

/**
 * Manually override an extract's inherited priority score (0–100).
 */
export async function setExtractPriority(id: string, priorityScore: number): Promise<void> {
  await invokeCommand("set_extract_priority", {
    id,
    priorityScore,
    priority_score: priorityScore,
  });
}
