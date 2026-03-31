export interface AnkiLatexFixture {
  name: string;
  input: string;
  expectContains: string[];
  expectFallback?: boolean;
}

export const ANKI_LATEX_FIXTURES: AnkiLatexFixture[] = [
  {
    name: "block latex wrapper",
    input: "[latex]x^{2} + y^{2}[/latex]",
    expectContains: ["math-expression-block", "katex"],
  },
  {
    name: "anki inline wrapper",
    input: "The value is [$]\\frac{1}{2}[/$].",
    expectContains: ["math-expression", "katex"],
  },
  {
    name: "display delimiters",
    input: "$$\\int_0^1 x^2 dx$$",
    expectContains: ["math-expression-block", "katex"],
  },
  {
    name: "escaped delimiters",
    input: "\\(a^2+b^2=c^2\\)",
    expectContains: ["math-expression", "katex"],
  },
  {
    name: "mixed malformed delimiter",
    input: "if $B \\neq 0\\]",
    expectContains: ["math-expression", "katex"],
  },
  {
    name: "raw latex plain text",
    input: "\\frac{d(n)y}{dx(n)} = f(x,y, \\frac{dy}{dx})",
    expectContains: ["math-expression", "katex"],
  },
  {
    name: "malformed expression fallback",
    input: "[$]\\frac{1}{2[/$]",
    // KaTeX with throwOnError:false renders malformed expressions gracefully
    expectContains: ["math-expression", "katex"],
  },
  {
    name: "unsupported command renders via KaTeX",
    input: "[$]\\unknowncmd{x}[/$]",
    // KaTeX with throwOnError:false renders unknown commands as styled text
    expectContains: ["math-expression", "katex"],
  },
  {
    name: "code block is preserved",
    input: "<code>[$]\\frac{1}{2}[/$]</code>",
    expectContains: ["<code>[$]\\frac{1}{2}[/$]</code>"],
  },
  {
    name: "currency is not parsed as math",
    input: "Price is $20 and discount is 5%",
    expectContains: ["Price is $20 and discount is 5%"],
  },
];
