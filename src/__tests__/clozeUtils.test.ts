import { describe, it, expect } from "vitest";
import { parseClozeDeletions, hasRawClozeSyntax, stripClozeMarkers } from "../utils/cloze";

describe("parseClozeDeletions", () => {
  it("parses single cloze deletion", () => {
    const text = "The GPL was released in {{c1::1989}}.";
    const deletions = parseClozeDeletions(text);
    expect(deletions).toHaveLength(1);
    expect(deletions[0]).toEqual({
      start: 24,
      end: 36,
      content: "1989",
      hint: undefined,
      number: 1,
    });
  });

  it("parses multiple cloze deletions with different numbers", () => {
    const text = "{{c1::Linux}} was created by {{c2::Linus Torvalds}} in {{c3::1991}}.";
    const deletions = parseClozeDeletions(text);
    expect(deletions).toHaveLength(3);
    expect(deletions[0].content).toBe("Linux");
    expect(deletions[0].number).toBe(1);
    expect(deletions[1].content).toBe("Linus Torvalds");
    expect(deletions[1].number).toBe(2);
    expect(deletions[2].content).toBe("1991");
    expect(deletions[2].number).toBe(3);
  });

  it("parses cloze with hint", () => {
    const text = "The capital of France is {{c1::Paris::a European city}}.";
    const deletions = parseClozeDeletions(text);
    expect(deletions).toHaveLength(1);
    expect(deletions[0].content).toBe("Paris");
    expect(deletions[0].hint).toBe("a European city");
  });

  it("returns empty array for no cloze syntax", () => {
    expect(parseClozeDeletions("Just plain text")).toHaveLength(0);
  });
});

describe("hasRawClozeSyntax", () => {
  it("detects cloze syntax", () => {
    expect(hasRawClozeSyntax("The answer is {{c1::42}}.")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(hasRawClozeSyntax("Just plain text")).toBe(false);
  });
});

describe("stripClozeMarkers", () => {
  it("removes markers keeping content", () => {
    expect(stripClozeMarkers("The {{c1::GPL}} was released in {{c2::1989}}."))
      .toBe("The GPL was released in 1989.");
  });

  it("preserves hints are stripped", () => {
    expect(stripClozeMarkers("Capital is {{c1::Paris::hint}}."))
      .toBe("Capital is Paris.");
  });
});
