export type DocumentInitialJump =
  | { kind: "pdf"; pageNumber: number }
  | { kind: "epub"; cfi: string }
  | { kind: "html"; scrollPercent: number }
  | { kind: "markdown"; scrollPercent: number }
  | { kind: "youtube"; timeSeconds: number; segmentId?: string };

export interface ExtractSourceContext {
  documentId: string;
  sourceTitle: string;
  sourceKind: "book" | "article" | "source";
  queueType?: "queue-scroll";
  initialJump?: DocumentInitialJump;
}
