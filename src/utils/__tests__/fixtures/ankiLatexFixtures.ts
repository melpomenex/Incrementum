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
    expectContains: ["math-expression-block", "<sup>2</sup>"],
  },
  {
    name: "anki inline wrapper",
    input: "The value is [$]\\frac{1}{2}[/$].",
    expectContains: ["math-expression", "numerator", "denominator"],
  },
  {
    name: "display delimiters",
    input: "$$\\int_0^1 x^2 dx$$",
    expectContains: ["math-expression-block", "&int;"],
  },
  {
    name: "escaped delimiters",
    input: "\\(a^2+b^2=c^2\\)",
    expectContains: ["math-expression", "<sup>2</sup>"],
  },
  {
    name: "mixed malformed delimiter",
    input: "if $B \\neq 0\\]",
    expectContains: ["math-expression", "&ne;"],
  },
  {
    name: "raw latex plain text",
    input: "\\frac{d(n)y}{dx(n)} = f(x,y, \\frac{dy}{dx})",
    expectContains: ["math-expression", "fraction"],
  },
  {
    name: "malformed expression fallback",
    input: "[$]\\frac{1}{2[/$]",
    expectContains: ["math-expression-fallback", "data-latex-fallback=\"true\""],
    expectFallback: true,
  },
  {
    name: "unsupported command fallback",
    input: "[$]\\unknowncmd{x}[/$]",
    expectContains: ["math-expression-fallback", "\\unknowncmd{x}"],
    expectFallback: true,
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
