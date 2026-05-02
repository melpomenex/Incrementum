export type ExactSearchHitLocation =
  | { kind: "pdf"; pageNumber: number; textQuote?: string; textOffsetHint?: number }
  | { kind: "epub"; cfi: string; cfiRange?: string; textQuote?: string; matchIndex?: number }
  | { kind: "html"; scrollPercent?: number; selector?: string; textQuote?: string }
  | { kind: "markdown"; scrollPercent?: number; textQuote?: string }
  | { kind: "youtube"; timeSeconds: number; segmentId?: string; textQuote?: string }
  | { kind: "audio"; timeSeconds: number; segmentId?: string; textQuote?: string };

export interface SearchHit {
  id: string;
  location: ExactSearchHitLocation;
  excerptHtml?: string;
  label?: string;
}

export interface DocumentSearchState {
  supported: boolean;
  available: boolean;
  totalMatches: number;
  activeMatchIndex: number;
  unavailableReason?: string;
}

export const DEFAULT_DOCUMENT_SEARCH_STATE: DocumentSearchState = {
  supported: true,
  available: true,
  totalMatches: 0,
  activeMatchIndex: 0,
};
