/**
 * RSS AI Summary Types
 * Types for summary caching, generation parameters, and UI state
 */

/** Summary length options with token mapping */
export type SummaryLength = "brief" | "medium" | "detailed";

/** Summary length configuration with token limits */
export const SUMMARY_LENGTH_CONFIG: Record<SummaryLength, { tokens: number; label: string }> = {
  brief: { tokens: 150, label: "Brief (~100 words)" },
  medium: { tokens: 300, label: "Medium (~200 words)" },
  detailed: { tokens: 600, label: "Detailed (~400 words)" },
};

/** Summary focus area options */
export type SummaryFocus = "key-points" | "actionable" | "background";

/** Summary focus area configuration */
export const SUMMARY_FOCUS_CONFIG: Record<SummaryFocus, { label: string; description: string }> = {
  "key-points": {
    label: "Key Points",
    description: "Emphasize main arguments and conclusions",
  },
  actionable: {
    label: "Actionable Items",
    description: "Focus on practical steps and recommendations",
  },
  background: {
    label: "Background Context",
    description: "Historical context, definitions, and foundations",
  },
};

/** Summary display mode */
export type SummaryMode = "modern" | "terminal";

/** Summary generation parameters */
export interface SummaryGenerationParams {
  length: SummaryLength;
  focus: SummaryFocus;
}

/** Summary cache entry with metadata */
export interface SummaryCacheEntry {
  /** The generated summary content */
  content: string;
  /** ISO 8601 timestamp of when summary was generated */
  timestamp: string;
  /** Length parameter used for generation */
  length: SummaryLength;
  /** Focus parameter used for generation */
  focus: SummaryFocus;
  /** Hash of article content for invalidation */
  contentHash: string;
  /** Whether to persist to localStorage (favorited articles only) */
  persisted?: boolean;
  /** Article title for reference */
  articleTitle?: string;
  /** Article URL for reference */
  articleUrl?: string;
}

/** RSS Summary settings stored in user preferences */
export interface RSSSummarySettings {
  /** Display mode: modern or terminal */
  mode: SummaryMode;
  /** Default summary length */
  defaultLength: SummaryLength;
  /** Default focus area */
  defaultFocus: SummaryFocus;
  /** Panel width in pixels */
  panelWidth: number;
  /** Panel position: left or right */
  panelPosition: "left" | "right";
  /** Whether panel is visible by default */
  autoOpen: boolean;
}

/** Default RSS summary settings */
export const DEFAULT_RSS_SUMMARY_SETTINGS: RSSSummarySettings = {
  mode: "modern",
  defaultLength: "medium",
  defaultFocus: "key-points",
  panelWidth: 320,
  panelPosition: "right",
  autoOpen: false,
};

/** Loading stage for summary generation */
export type SummaryLoadingStage = "analyzing" | "extracting" | "synthesizing" | "complete";

/** Loading stage configuration */
export const SUMMARY_LOADING_STAGES: Record<
  SummaryLoadingStage,
  { label: string; progress: number }
> = {
  analyzing: { label: "Analyzing content...", progress: 25 },
  extracting: { label: "Extracting key points...", progress: 60 },
  synthesizing: { label: "Synthesizing summary...", progress: 90 },
  complete: { label: "Complete", progress: 100 },
};

/** Panel display state */
export interface SummaryPanelState {
  isOpen: boolean;
  isLoading: boolean;
  currentStage: SummaryLoadingStage;
  error: string | null;
}

/** Cache statistics for debugging/monitoring */
export interface SummaryCacheStats {
  totalEntries: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  totalSizeBytes: number;
}
