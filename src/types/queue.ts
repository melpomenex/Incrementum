// Document file types that support transcription
export type DocumentFileType = 
  | 'pdf'
  | 'epub'
  | 'markdown'
  | 'html'
  | 'youtube'
  | 'video'
  | 'audio'
  | 'audiobook';

export interface QueueItem {
  id: string;
  documentId: string;
  documentTitle: string;
  documentFileType?: DocumentFileType;
  extractId?: string;
  learningItemId?: string;
  question?: string;
  answer?: string;
  clozeText?: string;
  itemType: "document" | "extract" | "learning-item" | "playlist-video" | "rss-article";
  priorityRating?: number;
  prioritySlider?: number;
  /** Inherited priority score (0–100) from the parent document; present on extract items. */
  priorityScore?: number;
  priority: number;
  dueDate?: string;
  estimatedTime: number; // in minutes
  tags: string[];
  category?: string;
  progress: number; // 0-100
  
  /** Source identifier, e.g., "playlist:<subscription_id>" */
  source?: string;
  /** Position in queue for interspersion calculation */
  position?: number;

  // FSRS / algorithm metadata (populated when available)
  stability?: number;
  difficulty?: number;
  interval?: number; // days (fractional for learning items, e.g. 0.1 = 2.4h)
  retrievability?: number;
  lapses?: number;
  reps?: number; // review_count

  // TAS ephemeral fields (not persisted)
  /** Whether this item is blocked by prerequisites (ephemeral, computed daily) */
  prerequisiteBlocked?: boolean;
  /** ISO datetime until which this item is delayed by interference (ephemeral, computed daily) */
  interferenceDelayUntil?: string;
  /** Human-readable reason for blocking/delay */
  blockReason?: string;
}

export interface ReviewSession {
  id: string;
  startTime: string;
  endTime?: string;
  itemsReviewed: number;
  correctAnswers: number;
  totalTime: number; // in seconds
  streakDays: number;
}

export interface ReviewItem {
  id: string;
  documentId: string;
  documentTitle: string;
  extractId?: string;
  learningItemId?: string;
  itemType: "learning-item";
  priority: number;
  dueDate?: string;
  estimatedTime: number;
  tags: string[];
  category?: string;
  progress: number;
  question: string;
  answer?: string;
  context?: string;
  hint?: string;
  relatedItems?: string[];
}

export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export interface ReviewResult {
  itemId: string;
  rating: Rating;
  timeTaken: number; // in seconds
  newDueDate: string;
  newInterval: number;
  newEaseFactor: number;
}

// Schedule View types
export interface ScheduleDayItem {
  id: string;
  documentId: string;
  documentTitle: string;
  documentFileType?: DocumentFileType;
  itemType: "document" | "extract" | "learning-item";
  dueDate: string;
  estimatedTime: number; // minutes
  stability?: number;
  difficulty?: number;
  interval?: number;
  retrievability?: number;
  lapses?: number;
  reps?: number;
  priority: number;
  tags: string[];
  category?: string;
  progress: number;
}

export interface ForecastPoint {
  date: string;
  due_learning_items: number;
  due_documents: number;
  due_total: number;
}

export interface ForecastSummary {
  horizon_days: number;
  due_total: number;
}

export interface WorkloadForecast {
  points: ForecastPoint[];
  summaries: ForecastSummary[];
}
