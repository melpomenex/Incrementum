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
    // Malformed expressions (unbalanced braces) produce KaTeX errors which are caught
    // and wrapped in a fallback with error details
    expectContains: ["math-expression-fallback", "data-latex-error"],
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
  {
    name: "mhchem chemical formula",
    input: "[$]\\ce{CO2 + H2O -> H2CO3}[/$]",
    expectContains: ["math-expression", "katex"],
  },
  {
    name: "mhchem physical unit",
    input: "[$]\\pu{9.8 m/s^2}[/$]",
    expectContains: ["math-expression", "katex"],
  },
  {
    name: "mhchem block chemical equation",
    input: "[latex]\\ce{^{227}_{90}Th+} -> \\ce{^{223}_{88}Ra} + \\alpha[/latex]",
    expectContains: ["math-expression-block", "katex"],
  },
  {
    name: "escaped dollar sign is not a delimiter",
    input: "Price is \\$20 not $\\alpha$",
    expectContains: ["$20", "math-expression", "katex"],
  },
  {
    name: "nested inline and block delimiters",
    input: "$x$ text $$\\int_0^1 x^2 dx$$ text $y$",
    expectContains: ["math-expression", "math-expression-block", "katex"],
  },
  {
    name: "display-mode env in inline auto-upgrades",
    input: "[$]\\begin{gather} a=b \\\\ c=d \\end{gather}[/$]",
    expectContains: ["math-expression-block", "katex"],
  },
  {
    name: "custom macro definition and usage",
    input: "\\newcommand{\\R}{\\mathbb{R}} x \\in \\R",
    expectContains: ["math-expression", "katex", "mathbb"],
  },
  {
    name: "DeclareMathOperator definition and usage",
    input: "\\DeclareMathOperator{\\argmin}{arg\\,min} \\argmin_x f(x)",
    expectContains: ["math-expression", "katex"],
  },
];
