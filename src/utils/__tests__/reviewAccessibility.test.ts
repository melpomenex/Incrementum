import { describe, expect, it } from "vitest";
import { getReviewAccessibilityConfig } from "../reviewAccessibility";

describe("reviewAccessibility", () => {
  it("keeps essential controls in normal mode", () => {
    const config = getReviewAccessibilityConfig(false);
    expect(config.rootRole).toBe("main");
    expect(config.requiresUndoButton).toBe(true);
    expect(config.requiresProgressRegion).toBe(true);
  });

  it("uses focus labels in zen mode", () => {
    const config = getReviewAccessibilityConfig(true);
    expect(config.rootAriaLabel).toBe("Focus review mode");
    expect(config.requiresUndoButton).toBe(false);
    expect(config.requiresProgressRegion).toBe(false);
  });
});
