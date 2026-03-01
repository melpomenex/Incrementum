export function getReviewAccessibilityConfig(zenMode: boolean) {
  return {
    rootRole: "main",
    rootAriaLabel: zenMode ? "Focus review mode" : "Review mode",
    requiresUndoButton: !zenMode,
    requiresProgressRegion: !zenMode,
  } as const;
}
