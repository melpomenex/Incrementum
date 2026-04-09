import { describe, expect, it, beforeEach } from "vitest";
import { MacroExpander } from "../latexMacros";

describe("MacroExpander", () => {
  let expander: MacroExpander;

  beforeEach(() => {
    expander = new MacroExpander();
  });

  describe("simple newcommand", () => {
    it("should expand a zero-arg macro", () => {
      expander.define("R", 0, "\\mathbb{R}");
      expect(expander.expand("x \\in \\R")).toBe("x \\in \\mathbb{R}");
    });

    it("should expand multiple occurrences", () => {
      expander.define("R", 0, "\\mathbb{R}");
      expect(expander.expand("\\R \\cup \\R")).toBe("\\mathbb{R} \\cup \\mathbb{R}");
    });

    it("should not expand partial command names", () => {
      expander.define("R", 0, "\\mathbb{R}");
      expect(expander.expand("\\RR")).toBe("\\RR");
    });
  });

  describe("macro with arguments", () => {
    it("should expand a macro with one argument", () => {
      expander.define("abs", 1, "\\left|#1\\right|");
      expect(expander.expand("\\abs{x+1}")).toBe("\\left|x+1\\right|");
    });

    it("should expand a macro with multiple arguments", () => {
      expander.define("binom", 2, "\\frac{#1!}{#2!(#1-#2)!}");
      expect(expander.expand("\\binom{n}{k}")).toBe("\\frac{n!}{k!(n-k)!}");
    });

    it("should handle single-character arguments without braces", () => {
      expander.define("abs", 1, "\\left|#1\\right|");
      expect(expander.expand("\\abs{x}")).toBe("\\left|x\\right|");
    });

    it("should handle nested braces in arguments", () => {
      expander.define("foo", 1, "\\text{#1}");
      expect(expander.expand("\\foo{a{b}c}")).toBe("\\text{a{b}c}");
    });
  });

  describe("parseDefinitions", () => {
    it("should parse \\newcommand and strip it", () => {
      const result = expander.parseDefinitions("\\newcommand{\\R}{\\mathbb{R}} x \\in \\R");
      expect(result).toContain("x \\in \\R");
      expect(result).not.toContain("\\newcommand");
      expect(expander.expand(result).trim()).toBe("x \\in \\mathbb{R}");
    });

    it("should parse \\newcommand with argument count", () => {
      const result = expander.parseDefinitions(
        "\\newcommand{\\abs}[1]{\\left|#1\\right|} \\abs{x}",
      );
      expect(expander.expand(result).trim()).toBe("\\left|x\\right|");
    });

    it("should parse \\renewcommand", () => {
      const result = expander.parseDefinitions("\\renewcommand{\\vec}[1]{\\mathbf{#1}} \\vec{v}");
      expect(expander.expand(result).trim()).toBe("\\mathbf{v}");
    });

    it("should parse \\DeclareMathOperator", () => {
      const result = expander.parseDefinitions(
        "\\DeclareMathOperator{\\argmin}{arg\\,min} \\argmin_x f(x)",
      );
      expect(expander.expand(result)).toContain("\\operatorname{arg\\,min}");
      expect(result).not.toContain("\\DeclareMathOperator");
    });
  });

  describe("process", () => {
    it("should parse definitions and expand in one call", () => {
      const result = expander.process("\\newcommand{\\R}{\\mathbb{R}} x \\in \\R");
      expect(result.trim()).toBe("x \\in \\mathbb{R}");
    });

    it("should handle multiple definitions", () => {
      const result = expander.process(
        "\\newcommand{\\R}{\\mathbb{R}} \\newcommand{\\N}{\\mathbb{N}} \\R \\cap \\N",
      );
      expect(result.trim()).toBe("\\mathbb{R} \\cap \\mathbb{N}");
    });
  });

  describe("reset", () => {
    it("should clear all definitions", () => {
      expander.define("R", 0, "\\mathbb{R}");
      expander.reset();
      expect(expander.expand("\\R")).toBe("\\R");
    });
  });

  describe("recursion depth limit", () => {
    it("should stop expanding after 10 levels of recursion", () => {
      expander.define("A", 0, "\\B");
      expander.define("B", 0, "\\A");
      const result = expander.expand("\\A");
      // Should terminate rather than loop forever
      expect(result.length).toBeLessThan(1000);
    });
  });

  describe("macro isolation", () => {
    it("should not leak definitions between expanders", () => {
      const expander1 = new MacroExpander();
      const expander2 = new MacroExpander();
      expander1.define("R", 0, "\\mathbb{R}");
      expect(expander2.expand("\\R")).toBe("\\R");
    });
  });
});
