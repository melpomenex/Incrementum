import { describe, expect, it } from "vitest";
import { analyzeCardQuality } from "../cardQuality";

describe("cardQuality", () => {
  it("scores concise direct cards higher", () => {
    const good = analyzeCardQuality("What is ATP?", "Primary cellular energy currency.");
    const poor = analyzeCardQuality("This is done by what?", "It is done by the thing.");
    expect(good.score).toBeGreaterThan(poor.score);
    expect(poor.issues.length).toBeGreaterThan(0);
  });
});

