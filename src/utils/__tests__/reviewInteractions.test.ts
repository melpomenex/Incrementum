import { describe, expect, it } from "vitest";
import {
  evaluateTypedAnswer,
  evaluateOrdering,
  evaluateMatching,
  generateProgressiveHints,
  normalizeAnswer,
} from "../reviewInteractions";

describe("reviewInteractions", () => {
  it("normalizes punctuation and whitespace", () => {
    expect(normalizeAnswer("  Hello,   World! ")).toBe("hello world");
  });

  it("grades exact answers strictly", () => {
    const pass = evaluateTypedAnswer("Paris", ["Paris", "City of Light"], "exact");
    const fail = evaluateTypedAnswer("Pariss", ["Paris"], "exact");
    expect(pass.isCorrect).toBe(true);
    expect(fail.isCorrect).toBe(false);
  });

  it("grades fuzzy answers with tolerance", () => {
    const pass = evaluateTypedAnswer("Mitochondria", ["Mitochondrion"], "fuzzy");
    const fail = evaluateTypedAnswer("cell wall", ["mitochondria"], "fuzzy");
    expect(pass.isCorrect).toBe(true);
    expect(fail.isCorrect).toBe(false);
    expect(pass.similarity).toBeGreaterThan(fail.similarity);
  });

  it("builds three progressive fallback hints", () => {
    const hints = generateProgressiveHints("Spaced repetition strengthens long-term memory");
    expect(hints).toHaveLength(3);
    expect(hints[0].length).toBeGreaterThan(0);
    expect(hints[2].length).toBeGreaterThanOrEqual(hints[1].length);
  });

  it("evaluates ordering interactions", () => {
    const result = evaluateOrdering(["a", "b", "c"], ["a", "c", "b"]);
    expect(result.total).toBe(3);
    expect(result.correctPositions).toBe(1);
    expect(result.isCorrect).toBe(false);
  });

  it("evaluates matching interactions", () => {
    const result = evaluateMatching(
      [
        { left: "Cat", right: "Mammal" },
        { left: "Snake", right: "Reptile" },
      ],
      [
        { left: "Cat", right: "Mammal" },
        { left: "Snake", right: "Reptile" },
      ]
    );
    expect(result.isCorrect).toBe(true);
    expect(result.correctPairs).toBe(2);
  });
});
