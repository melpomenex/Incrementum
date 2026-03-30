import { invokeCommand } from "../lib/tauri";

export interface PreviewIntervals {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export interface ReviewStreak {
  current_streak: number;
  longest_streak: number;
  total_reviews: number;
  last_review_date?: string;
}

export async function startReview(): Promise<string> {
  return await invokeCommand<string>("start_review");
}

export async function submitReview(
  itemId: string,
  rating: number,
  timeTaken: number,
  sessionId?: string,
  options?: {
    desiredRetention?: number;
    fsrsWeights?: number[];
    algorithm?: "fsrs" | "sm2" | "sm18";
    noScheduleUpdate?: boolean;
  }
): Promise<LearningItem> {
  const normalizedSessionId = sessionId?.trim() ? sessionId : undefined;
  return await invokeCommand<LearningItem>("submit_review", {
    item_id: itemId,
    itemId,
    rating,
    time_taken: timeTaken,
    timeTaken,
    session_id: normalizedSessionId,
    sessionId: normalizedSessionId,
    desired_retention: options?.desiredRetention,
    desiredRetention: options?.desiredRetention,
    fsrs_weights: options?.fsrsWeights,
    fsrsWeights: options?.fsrsWeights,
    algorithm: options?.algorithm,
    no_schedule_update: options?.noScheduleUpdate,
    noScheduleUpdate: options?.noScheduleUpdate,
  });
}

export async function restoreLearningItemState(
  itemId: string,
  previousState: {
    dueDate: string;
    interval: number;
    easeFactor: number;
    lastReviewDate?: string;
    reviewCount: number;
    lapses: number;
    state: string;
    memoryState?: { stability: number; difficulty: number } | null;
    difficulty: number;
  }
): Promise<LearningItem> {
  return await invokeCommand<LearningItem>("restore_learning_item_state", {
    item_id: itemId,
    itemId,
    due_date: previousState.dueDate,
    dueDate: previousState.dueDate,
    interval: previousState.interval,
    ease_factor: previousState.easeFactor,
    easeFactor: previousState.easeFactor,
    last_review_date: previousState.lastReviewDate,
    lastReviewDate: previousState.lastReviewDate,
    review_count: previousState.reviewCount,
    reviewCount: previousState.reviewCount,
    lapses: previousState.lapses,
    state: previousState.state,
    memory_state: previousState.memoryState ?? null,
    memoryState: previousState.memoryState ?? null,
    difficulty: previousState.difficulty,
  });
}

export async function getDueItems(): Promise<LearningItem[]> {
  return await invokeCommand<LearningItem[]>("get_due_items");
}

export async function previewReviewIntervals(
  itemId: string,
  algorithm?: string
): Promise<PreviewIntervals> {
  return await invokeCommand<PreviewIntervals>("preview_review_intervals", {
    item_id: itemId,
    itemId,
    algorithm,
  });
}

export async function getReviewStreak(): Promise<ReviewStreak> {
  return await invokeCommand<ReviewStreak>("get_review_streak");
}

export interface LearningItem {
  id: string;
  extract_id?: string;
  document_id?: string;
  item_type: "flashcard" | "cloze" | "qa" | "basic" | "Cloze";
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
  state: "new" | "learning" | "review" | "relearning";
  is_suspended: boolean;
  tags: string[];
  memory_state?: {
    stability: number;
    difficulty: number;
  };
  interaction_metadata?: Record<string, unknown>;
  source_anchor?: {
    document_id?: string;
    extract_id?: string;
    page_number?: number;
    start_offset?: number;
    end_offset?: number;
  };
}

export type ReviewRating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export const RATING_LABELS: Record<ReviewRating, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

export const RATING_COLORS: Record<ReviewRating, string> = {
  1: "bg-red-500 hover:bg-red-600",
  2: "bg-orange-500 hover:bg-orange-600",
  3: "bg-blue-500 hover:bg-blue-600",
  4: "bg-green-500 hover:bg-green-600",
};

export function formatInterval(days: number): string {
  if (days < 1) return "< 1 day";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  return `${Math.floor(days / 365)} years`;
}
