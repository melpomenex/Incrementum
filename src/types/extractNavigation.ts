import type { ExactSearchHitLocation } from "./searchHit";

export type DocumentInitialJump = ExactSearchHitLocation;

export interface ExtractSourceContext {
  documentId: string;
  sourceTitle: string;
  sourceKind: "book" | "article" | "source";
  queueType?: "queue-scroll";
  initialJump?: DocumentInitialJump;
}
