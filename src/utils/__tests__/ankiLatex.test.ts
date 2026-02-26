import { describe, expect, it } from "vitest";
import { renderAnkiHtmlWithLatex } from "../ankiLatex";

describe("renderAnkiHtmlWithLatex", () => {
  it("renders [latex]...[/latex] blocks", () => {
    const html = renderAnkiHtmlWithLatex("[latex]x^{2} + y^{2}[/latex]");
    expect(html).toContain("math-expression-block");
    expect(html).toContain("<sup>2</sup>");
  });

  it("renders anki [$]...[/$] inline markers", () => {
    const html = renderAnkiHtmlWithLatex("The value is [$]\\frac{1}{2}[/$].");
    expect(html).toContain("math-expression");
    expect(html).toContain("numerator");
    expect(html).toContain("denominator");
  });

  it("leaves plain html unchanged", () => {
    const input = "<b>Hello</b> world";
    expect(renderAnkiHtmlWithLatex(input)).toBe(input);
  });

  it("handles malformed mixed delimiters and orphan latex tags", () => {
    const html = renderAnkiHtmlWithLatex("if $B \\neq 0\\]\n[/latex]");
    expect(html).toContain("math-expression");
    expect(html).toContain("&ne;");
    expect(html).not.toContain("[/latex]");
    expect(html).not.toContain("\\]");
  });

  it("renders raw latex without delimiters for imported cards", () => {
    const html = renderAnkiHtmlWithLatex("\\frac{d(n)y}{dx(n)} = f(x,y, \\frac{dy}{dx})");
    expect(html).toContain("math-expression");
    expect(html).toContain("fraction");
    expect(html).not.toContain("\\frac");
  });
});
