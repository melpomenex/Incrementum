import { describe, expect, it } from "vitest";
import { deriveCurrentPageFromOffsets, shouldSuppressProgrammaticScroll } from "../pdfNavigationStability";

describe("pdfNavigationStability integration behavior", () => {
  it("keeps page progression continuous with virtualized offset estimates", () => {
    const numPages = 8;
    const stride = 1024;
    const offsets = Array.from({ length: numPages }, (_, i) => i * stride);
    const scrollTrace = [0, 150, 700, 1200, 1850, 2300, 3150, 4200, 5100, 6120, 7150];

    const pages = scrollTrace.map((scrollTop) =>
      deriveCurrentPageFromOffsets(offsets, numPages, 1, scrollTop),
    );

    for (let i = 1; i < pages.length; i += 1) {
      expect(pages[i]).toBeGreaterThanOrEqual(pages[i - 1]);
    }
    expect(pages[pages.length - 1]).toBe(numPages);
  });

  it("rejects stale TOC updates while accepting active navigation token", () => {
    const activeToken = 9;
    const staleRejected = shouldSuppressProgrammaticScroll({
      enabled: true,
      source: "toc",
      token: 8,
      now: 100,
      lockoutUntil: 2000,
      activeToken,
    });
    const activeAllowed = shouldSuppressProgrammaticScroll({
      enabled: true,
      source: "toc",
      token: 9,
      now: 100,
      lockoutUntil: 2000,
      activeToken,
    });

    expect(staleRejected).toBe(true);
    expect(activeAllowed).toBe(false);
  });
});
