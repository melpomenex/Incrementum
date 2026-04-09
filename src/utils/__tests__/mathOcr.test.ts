/**
 * Tests for math OCR utilities
 */

import { describe, it, expect } from "vitest";
import {
  latexToHTML,
  validateLatex,
  extractMathFromText,
  detectMathContent,
  cleanMathOCR,
  shouldUseDisplayMode,
} from "../mathOcr";

describe("mathOcr", () => {
  describe("latexToHTML", () => {
    it("should render LaTeX using KaTeX", () => {
      const html = latexToHTML("\\frac{1}{2}");

      expect(html).toContain("katex");
      expect(html).toContain("1");
      expect(html).toContain("2");
    });

    it("should render square root", () => {
      const html = latexToHTML("\\sqrt{x}");

      expect(html).toContain("katex");
      expect(html).toContain("x");
    });

    it("should render superscript and subscript", () => {
      const html = latexToHTML("x^{2} + y_1");

      expect(html).toContain("katex");
      expect(html).toContain("2");
      expect(html).toContain("1");
    });

    it("should render Greek letters", () => {
      const html = latexToHTML("\\pi \\alpha \\beta");

      expect(html).toContain("katex");
      // KaTeX renders Greek letters as styled spans, not HTML entities
      expect(html).toContain("mathnormal");
    });

    it("should render math operators", () => {
      const html = latexToHTML("\\sum \\prod \\int \\infty");

      expect(html).toContain("katex");
    });

    it("should render text commands like mbox", () => {
      const html = latexToHTML("y=ux \\mbox{or} x=vy");

      expect(html).toContain("katex");
      expect(html).toContain("or");
    });

    it("should render relation and operation commands", () => {
      const html = latexToHTML("a \\leq b, c \\neq d, x \\to y, p \\times q");

      expect(html).toContain("katex");
    });

    it("should render overline and other decoration commands", () => {
      const html = latexToHTML("\\overline{AB}");

      expect(html).toContain("katex");
      expect(html).toContain("AB");
    });

    it("should render hat and vec commands", () => {
      const html = latexToHTML("\\hat{x} + \\vec{v}");

      expect(html).toContain("katex");
    });

    it("should render mathbb and mathcal commands", () => {
      const html = latexToHTML("\\mathbb{R} \\cup \\mathcal{S}");

      expect(html).toContain("katex");
    });

    it("should wrap output in math-expression span", () => {
      const html = latexToHTML("x^2");
      expect(html).toContain("math-expression");
    });

    it("should handle empty LaTeX", () => {
      const html = latexToHTML("");
      expect(html).toContain("math-expression");
    });

    it("should render chemistry notation via mhchem", () => {
      const html = latexToHTML("\\ce{CO2 + H2O -> H2CO3}");
      expect(html).toContain("katex");
      expect(html).not.toContain("katex-error");
    });

    it("should render physical units via mhchem", () => {
      const html = latexToHTML("\\pu{9.8 m/s^2}");
      expect(html).toContain("katex");
      expect(html).not.toContain("katex-error");
    });

    it("should render isotopes via mhchem", () => {
      const html = latexToHTML("\\ce{^{227}_{90}Th+}");
      expect(html).toContain("katex");
      expect(html).not.toContain("katex-error");
    });

    it("should auto-detect display mode for gather environment", () => {
      const html = latexToHTML("\\begin{gather} a=b \\\\ c=d \\end{gather}");
      expect(html).toContain("math-expression-block");
      expect(html).not.toContain("katex-error");
    });

    it("should auto-detect display mode for split environment", () => {
      const html = latexToHTML("\\begin{split} a &= b + c \\\\ &= d \\end{split}");
      expect(html).toContain("math-expression-block");
      expect(html).not.toContain("katex-error");
    });

    it("should auto-detect display mode for tag command", () => {
      const html = latexToHTML("\\int_0^1 x^2 dx \\tag{1}");
      expect(html).toContain("math-expression-block");
      expect(html).not.toContain("katex-error");
    });

    it("should use explicit displayMode option when provided", () => {
      const html = latexToHTML("x^2 + y^2", { displayMode: true });
      expect(html).toContain("math-expression");
    });

    it("should keep inline mode for simple expressions without display-only envs", () => {
      const html = latexToHTML("\\frac{1}{2}");
      expect(html).toContain("math-expression");
      expect(html).not.toContain("math-expression-block");
    });

    it("should show fallback with error attribute for truly broken LaTeX", () => {
      // \ce requires mhchem; if the extension failed to load, \ce{CO2} would error
      // Use a known-broken expression to test the fallback path
      const html = latexToHTML("\\begin{tikzpicture} \\draw (0,0) -- (1,1); \\end{tikzpicture}");
      expect(html).toContain("math-expression-fallback");
      expect(html).toContain("data-latex-error");
    });

    it("should include raw source in fallback output", () => {
      const html = latexToHTML("\\begin{tikzpicture} test \\end{tikzpicture}");
      expect(html).toContain("math-expression-fallback");
      expect(html).toContain("tikzpicture");
    });
  });

  describe("validateLatex", () => {
    it("should validate correct LaTeX", () => {
      const result = validateLatex("\\frac{1}{2} + \\sqrt{x}");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect unmatched opening brace", () => {
      const result = validateLatex("\\frac{1}{2");

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("brace"))).toBe(true);
    });

    it("should detect unmatched closing brace", () => {
      const result = validateLatex("\\frac{1}}{2}");

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("brace"))).toBe(true);
    });

    it("should detect unmatched math delimiters", () => {
      const result = validateLatex("$$x = 5");

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("delimiter"))).toBe(true);
    });

    it("should validate empty LaTeX", () => {
      const result = validateLatex("");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("extractMathFromText", () => {
    it("should extract inline math expressions", () => {
      const text = "The equation $x^2 + y^2 = r^2$ describes a circle.";
      const math = extractMathFromText(text);

      expect(math).toContain("x^2 + y^2 = r^2");
    });

    it("should extract display math expressions", () => {
      const text = "The integral is $$\\int_0^1 x^2 dx$$";
      const math = extractMathFromText(text);

      expect(math.length).toBeGreaterThan(0);
      expect(math[0]).toContain("int");
    });

    it("should extract multiple math expressions", () => {
      const text = "We have $a + b$ and $c \\times d$ and $e / f$";
      const math = extractMathFromText(text);

      expect(math.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle text without math", () => {
      const text = "This is just plain text without any mathematical expressions.";
      const math = extractMathFromText(text);

      expect(math).toEqual([]);
    });

    it("should handle empty text", () => {
      const math = extractMathFromText("");

      expect(math).toEqual([]);
    });
  });

  describe("detectMathContent", () => {
    it("should detect math symbols", () => {
      const text = "The integral ∫ and sum ∑ operators are important.";
      const result = detectMathContent(text);

      expect(result.hasMath).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.indicators.some(i => i.includes("symbols"))).toBe(true);
    });

    it("should detect subscripts and superscripts", () => {
      const text = "The formula H_2O and x^{2+y} contains notation.";
      const result = detectMathContent(text);

      expect(result.hasMath).toBe(true);
      expect(result.indicators.some(i => i.includes("subscript") || i.includes("superscript"))).toBe(true);
    });

    it("should detect fractions", () => {
      const text = "The value \\frac{1}{2} represents half.";
      const result = detectMathContent(text);

      expect(result.hasMath).toBe(true);
      expect(result.indicators.some(i => i.toLowerCase().includes("fraction"))).toBe(true);
    });

    it("should detect Greek letters", () => {
      const text = "The variables \\alpha, \\beta, and \\gamma are parameters.";
      const result = detectMathContent(text);

      expect(result.hasMath).toBe(true);
      expect(result.indicators.some(i => i.includes("Greek"))).toBe(true);
    });

    it("should detect math operators", () => {
      const text = "The \\sum and \\prod operators are common.";
      const result = detectMathContent(text);

      expect(result.hasMath).toBe(true);
      expect(result.indicators.some(i => i.includes("operator"))).toBe(true);
    });

    it("should not detect math in plain text", () => {
      const text = "This is just plain text without any mathematical content.";
      const result = detectMathContent(text);

      expect(result.hasMath).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
    });

    it("should calculate confidence score", () => {
      const text = "∫_0^1 x^{2} dx with \\alpha and \\sum";
      const result = detectMathContent(text);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe("shouldUseDisplayMode", () => {
    it("should detect gather environment", () => {
      expect(shouldUseDisplayMode("\\begin{gather} a=b \\end{gather}")).toBe(true);
    });

    it("should detect split environment", () => {
      expect(shouldUseDisplayMode("\\begin{split} a &= b \\end{split}")).toBe(true);
    });

    it("should detect tag command", () => {
      expect(shouldUseDisplayMode("E=mc^2 \\tag{1}")).toBe(true);
    });

    it("should detect multline environment", () => {
      expect(shouldUseDisplayMode("\\begin{multline} a \\end{multline}")).toBe(true);
    });

    it("should not trigger for simple expressions", () => {
      expect(shouldUseDisplayMode("\\frac{1}{2}")).toBe(false);
    });

    it("should not trigger for inline-friendly aligned", () => {
      // 'aligned' is different from 'align' — aligned works in both modes
      expect(shouldUseDisplayMode("\\begin{aligned} a &= b \\end{aligned}")).toBe(false);
    });

    it("should detect align environment (display-only)", () => {
      expect(shouldUseDisplayMode("\\begin{align} a &= b \\end{align}")).toBe(true);
    });
  });

  describe("cleanMathOCR", () => {
    it("should convert math symbols to LaTeX", () => {
      const text = "The integral ∫ should become \\int";
      const cleaned = cleanMathOCR(text);

      expect(cleaned).toContain("\\int");
    });

    it("should convert infinity symbol", () => {
      const text = "The limit approaches ∞";
      const cleaned = cleanMathOCR(text);

      expect(cleaned).toContain("\\infty");
    });

    it("should convert inequality symbols", () => {
      const text = "x ≤ y and z ≥ w";
      const cleaned = cleanMathOCR(text);

      expect(cleaned).toContain("\\leq");
      expect(cleaned).toContain("\\geq");
    });

    it("should convert approximation symbol", () => {
      const text = "π ≈ 3.14";
      const cleaned = cleanMathOCR(text);

      expect(cleaned).toContain("\\approx");
    });

    it("should clean up extra whitespace", () => {
      const text = "x   +    y     =     z";
      const cleaned = cleanMathOCR(text);

      expect(cleaned).toBe("x + y = z");
    });

    it("should trim leading/trailing whitespace", () => {
      const text = "   x + y = z   ";
      const cleaned = cleanMathOCR(text);

      expect(cleaned).toBe("x + y = z");
    });

    it("should handle empty text", () => {
      const cleaned = cleanMathOCR("");
      expect(cleaned).toBe("");
    });
  });
});
