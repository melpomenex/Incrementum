import { invokeCommand, isTauri } from "../lib/tauri";
import type { LearningItemInteractionMetadata } from "../types/learningItemInteractions";

export interface LearningItem {
  id: string;
  extract_id?: string;
  document_id?: string;
  item_type: "Flashcard" | "Cloze" | "Qa" | "Basic";
  question: string;
  answer?: string;
  cloze_text?: string;
  cloze_ranges?: [number, number][];
  difficulty: number;
  interval: number;
  ease_factor: number;
  due_date: string;
  date_created: string;
  date_modified: string;
  last_review_date?: string;
  review_count: number;
  lapses: number;
  state: "New" | "Learning" | "Review" | "Relearning";
  is_suspended: boolean;
  tags: string[];
  image_asset_ids?: string[];
  interaction_metadata?: LearningItemInteractionMetadata;
  memory_state?: {
    stability: number;
    difficulty: number;
  };
  algorithm_type?: string;
  algorithm_state?: string;
}

export interface CreateLearningItemInput {
  item_type: string;
  question: string;
  answer?: string;
  cloze_text?: string;
  document_id?: string;
  prerequisite_item_ids?: string[];
  tags?: string[];
  image_asset_ids?: string[];
  interaction_metadata?: LearningItemInteractionMetadata;
  allow_duplicate?: boolean;
}

export interface DuplicateCandidate {
  id: string;
  question: string;
  similarity: number;
}

export interface CardVersionEntry {
  version_id: string;
  item_id: string;
  timestamp: string;
  reason?: string;
  question: string;
  answer?: string;
}

/**
 * Get learning items that are due for review
 */
export async function getDueItems(): Promise<LearningItem[]> {
  return await invokeCommand<LearningItem[]>("get_due_items");
}

/**
 * Get all learning items for a document
 */
export async function getLearningItems(documentId: string): Promise<LearningItem[]> {
  return await invokeCommand<LearningItem[]>("get_learning_items", { documentId });
}

/**
 * Get a single learning item by ID
 */
export async function getLearningItem(itemId: string): Promise<LearningItem | null> {
  return await invokeCommand<LearningItem | null>("get_learning_item", { itemId });
}

/**
 * Get all learning items for an extract
 */
export async function getLearningItemsByExtract(extractId: string): Promise<LearningItem[]> {
  return await invokeCommand<LearningItem[]>("get_learning_items_by_extract", { extractId });
}

export async function getAllLearningItems(): Promise<LearningItem[]> {
  return await invokeCommand<LearningItem[]>("get_all_learning_items");
}

/**
 * Create a new learning item
 */
export async function createLearningItem(input: CreateLearningItemInput): Promise<LearningItem> {
  return await invokeCommand<LearningItem>("create_learning_item", {
    itemType: input.item_type,
    question: input.question,
    answer: input.answer,
    clozeText: input.cloze_text,
    documentId: input.document_id,
    prerequisiteItemIds: input.prerequisite_item_ids,
    tags: input.tags,
    imageAssetIds: input.image_asset_ids,
    interactionMetadata: input.interaction_metadata,
    allowDuplicate: input.allow_duplicate,
  });
}

export async function checkSemanticDuplicateCandidates(
  question: string,
  limit: number = 5
): Promise<DuplicateCandidate[]> {
  return await invokeCommand<DuplicateCandidate[]>("check_semantic_duplicate_candidates", {
    question,
    limit,
  });
}

/**
 * Generate learning items from an extract
 * This automatically creates cloze deletions and Q&A pairs from the extract content
 */
export async function generateLearningItemsFromExtract(extractId: string): Promise<LearningItem[]> {
  if (!isTauri()) return Promise.reject(new Error("This feature requires the desktop app"));
  return await invokeCommand<LearningItem[]>("generate_learning_items_from_extract", {
    extractId,
  });
}

export async function updateLearningItemContentWithVersion(
  itemId: string,
  question: string,
  answer?: string,
  reason?: string
): Promise<LearningItem> {
  return await invokeCommand<LearningItem>("update_learning_item_content_with_version", {
    itemId,
    question,
    answer,
    reason,
  });
}

export async function getLearningItemVersions(itemId: string): Promise<CardVersionEntry[]> {
  return await invokeCommand<CardVersionEntry[]>("get_learning_item_versions", { itemId });
}

export async function revertLearningItemVersion(itemId: string, versionId: string): Promise<LearningItem> {
  return await invokeCommand<LearningItem>("revert_learning_item_version", {
    itemId,
    versionId,
  });
}

export async function exportMnemosyne(outputPath?: string): Promise<string> {
  return await invokeCommand<string>("export_mnemosyne", { outputPath });
}

export async function setLearningItemPrerequisites(itemId: string, prerequisiteItemIds: string[]): Promise<void> {
  await invokeCommand("set_learning_item_prerequisites", { itemId, prerequisiteItemIds });
}

export async function getLearningItemPrerequisites(itemId: string): Promise<string[]> {
  return await invokeCommand<string[]>("get_learning_item_prerequisites", { itemId });
}

export async function getDailyNoteLinks(date?: string): Promise<Array<Record<string, unknown>>> {
  return await invokeCommand<Array<Record<string, unknown>>>("get_daily_note_links", { date });
}

/**
 * Get the item type display name
 */
export function getItemTypeName(itemType: LearningItem["item_type"]): string {
  switch (itemType) {
    case "Flashcard":
      return "Flashcard";
    case "Cloze":
      return "Cloze Deletion";
    case "Qa":
      return "Q&A";
    case "Basic":
      return "Basic";
    default:
      return "Unknown";
  }
}

/**
 * Get the item state display name
 */
export function getItemStateName(state: LearningItem["state"]): string {
  switch (state) {
    case "New":
      return "New";
    case "Learning":
      return "Learning";
    case "Review":
      return "Review";
    case "Relearning":
      return "Relearning";
    default:
      return "Unknown";
  }
}
