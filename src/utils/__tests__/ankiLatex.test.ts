import { describe, expect, it } from "vitest";
import {
  normalizeAnkiFlashcardFields,
  normalizeAnkiLatexContent,
  renderAnkiHtmlWithLatex,
  reprocessAnkiLatexContent,
  warmAnkiLatexNormalization,
} from "../ankiLatex";
import { ANKI_LATEX_FIXTURES } from "./fixtures/ankiLatexFixtures";

describe("ankiLatex normalization", () => {
  it("renders fixture corpus consistently", () => {
    for (const fixture of ANKI_LATEX_FIXTURES) {
      const result = normalizeAnkiLatexContent(fixture.input);
      for (const expected of fixture.expectContains) {
        expect(result.html, fixture.name).toContain(expected);
      }

      if (fixture.expectFallback) {
        expect(result.hasFallback, fixture.name).toBe(true);
      }
    }
  });

  it("returns a canonical token stream with type metadata", () => {
    const result = normalizeAnkiLatexContent("Value: [$]x^2[/$], block: [latex]y^2[/latex]");

    const tokenTypes = result.tokens.map((token) => token.type);
    expect(tokenTypes).toContain("text");
    expect(tokenTypes).toContain("math-inline");
    expect(tokenTypes).toContain("math-block");
  });

  it("keeps orphan latex tags out of output", () => {
    const result = normalizeAnkiLatexContent("test [/latex] content [latex]");
    expect(result.html).not.toContain("[/latex]");
    expect(result.html).not.toContain("[latex]");
  });

  it("preserves code contexts without rewriting latex-like text", () => {
    const input = "Inline `[$]\\frac{1}{2}[/$]` and <code>\\(x\\)</code>";
    const result = normalizeAnkiLatexContent(input);
    expect(result.html).toContain("`[$]\\frac{1}{2}[/$]`");
    expect(result.html).toContain("<code>\\(x\\)</code>");
  });

  it("supports lazy backfill cache warm-up and reprocessing", () => {
    warmAnkiLatexNormalization(["[$]x^2[/$]", "[latex]y^2[/latex]"]);

    const first = normalizeAnkiLatexContent("[$]x^2[/$]");
    const second = normalizeAnkiLatexContent("[$]x^2[/$]");
    expect(first).toBe(second);

    const refreshed = reprocessAnkiLatexContent("[$]x^2[/$]");
    expect(refreshed).not.toBe(second);
    expect(refreshed.html).toContain("<sup>2</sup>");
  });

  it("normalizes flashcard fields as derived metadata", () => {
    const normalized = normalizeAnkiFlashcardFields({
      question: "[$]x^2[/$]",
      answer: "[latex]x^{2}+1[/latex]",
      clozeText: "Solve [[c1::[$]x^2[/$]]]",
    });

    expect(normalized.question?.html).toContain("<sup>2</sup>");
    expect(normalized.answer?.html).toContain("math-expression-block");
    expect(normalized.clozeText?.html).toContain("math-expression");
  });

  it("renderAnkiHtmlWithLatex returns normalized html", () => {
    const html = renderAnkiHtmlWithLatex("The value is [$]\\frac{1}{2}[/$].");
    expect(html).toContain("math-expression");
    expect(html).toContain("numerator");
    expect(html).toContain("denominator");
  });
});
