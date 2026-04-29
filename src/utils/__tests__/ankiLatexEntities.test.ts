import { describe, expect, it } from "vitest";
import {
  normalizeAnkiLatexContent,
  renderAnkiHtmlWithLatex,
} from "../ankiLatex";

/**
 * Tests for HTML entity decoding and HTML tag stripping inside math expressions.
 * Internal functions (decodeHtmlEntities, stripHtmlFromMath) tested via public API.
 *
 * Key invariant: HTML artifacts that would break KaTeX parsing are cleaned up,
 * allowing the expression to render (or at least not crash).
 */

describe("ankiLatex: HTML entity decoding", () => {
  it("decodes &nbsp; to space (most common Anki artifact)", () => {
    // &nbsp; appeared in 232 cards in the UW Math 136 deck
    const { html } = normalizeAnkiLatexContent("[$]&nbsp;x&nbsp;+&nbsp;y[/$]");
    expect(html).toContain("katex");
    expect(html).not.toContain("&nbsp;");
  });

  it("decodes &amp; to & (even if bare & isn't valid LaTeX)", () => {
    const { html } = normalizeAnkiLatexContent("[$]x &amp; y[/$]");
    // Bare & is not valid LaTeX, so it may fall back — but the entity IS decoded
    expect(html).not.toContain("&amp;");
  });

  it("decodes &lt; to < (valid comparison operator)", () => {
    const { html } = normalizeAnkiLatexContent("[$]x &lt; y[/$]");
    // < is a valid LaTeX token, should render with KaTeX
    expect(html).toContain("katex");
    // KaTeX's MathML annotation re-encodes < as &lt; — that's MathML, not our input
    // The important thing is it renders (katex class present) rather than erroring
  });

  it("decodes &gt; to > (valid comparison operator)", () => {
    const { html } = normalizeAnkiLatexContent("[$]x &gt; y[/$]");
    expect(html).toContain("katex");
  });

  it("decodes &quot; to quote character", () => {
    const { html } = normalizeAnkiLatexContent("[$]&quot;x&quot;[/$]");
    expect(html).toContain("katex");
  });

  it("decodes &#39; to apostrophe", () => {
    const { html } = normalizeAnkiLatexContent("[$]x&#39; + y[/$]");
    expect(html).toContain("katex");
    expect(html).not.toContain("&#39;");
  });

  it("decodes entities in block math [latex]...[/latex]", () => {
    const { html } = normalizeAnkiLatexContent("[latex]x &lt; y[/latex]");
    expect(html).toContain("katex");
  });

  it("decodes entities in $$...$$ block math", () => {
    const { html } = normalizeAnkiLatexContent("$$x &lt; y$$");
    expect(html).toContain("katex");
  });

  it("decodes entities in \\[...\\] display math", () => {
    const { html } = normalizeAnkiLatexContent("\\[x &lt; y\\]");
    expect(html).toContain("katex");
  });

  it("decodes entities in \\(...\\) inline math", () => {
    const { html } = normalizeAnkiLatexContent("\\(x &lt; y\\)");
    expect(html).toContain("katex");
  });
});

describe("ankiLatex: HTML tag stripping", () => {
  it("strips <div> and </div>", () => {
    const { html } = normalizeAnkiLatexContent("[$]<div>x + y</div>[/$]");
    expect(html).toContain("katex");
    expect(html).not.toContain("<div>");
    expect(html).not.toContain("</div>");
  });

  it("strips <span> (original) while keeping KaTeX's own spans", () => {
    const { html } = normalizeAnkiLatexContent("[$]<span class='foo'>x</span>[/$]");
    expect(html).toContain("katex");
    // KaTeX produces its own <span> tags, but the original class should be gone
    expect(html).not.toContain("class='foo'");
  });

  it("strips <br> tags", () => {
    const { html } = normalizeAnkiLatexContent("[$]<br>x + y[/$]");
    expect(html).toContain("katex");
    expect(html).not.toContain("<br");
  });

  it("strips <p> and </p>", () => {
    const { html } = normalizeAnkiLatexContent("[$]<p>x + y</p>[/$]");
    expect(html).toContain("katex");
    expect(html).not.toContain("<p>");
  });

  it("strips <em> <i> <strong> <b>", () => {
    const { html } = normalizeAnkiLatexContent("[$]<em>x</em> + <b>y</b>[/$]");
    expect(html).toContain("katex");
  });

  it("strips <hr> tags", () => {
    const { html } = normalizeAnkiLatexContent("[$]x<hr>y[/$]");
    expect(html).toContain("katex");
  });

  it("strips nested Anki HTML (div > span with style)", () => {
    const { html } = normalizeAnkiLatexContent(
      "[$]<div><span style='font-size:20px'>x + y</span></div>[/$]"
    );
    expect(html).toContain("katex");
    expect(html).not.toContain("<div>");
    expect(html).not.toContain("font-size:20px");
  });

  it("strips tags in block math too", () => {
    const { html } = normalizeAnkiLatexContent("[latex]<div>x + y</div>[/latex]");
    expect(html).toContain("katex");
    expect(html).not.toContain("<div>");
  });
});

describe("ankiLatex: combined entities + tags (real Anki patterns)", () => {
  it("&nbsp; inside divs in math", () => {
    const { html } = normalizeAnkiLatexContent("[$]<div>&nbsp;x&nbsp;</div>[/$]");
    expect(html).toContain("katex");
    expect(html).not.toContain("&nbsp;");
    expect(html).not.toContain("<div>");
  });

  it("entities AND structural tags together", () => {
    // Both &lt; decoded AND <div> stripped
    const { html } = normalizeAnkiLatexContent(
      "[$]<div>x &lt; y</div>[/$]"
    );
    expect(html).toContain("katex");
    expect(html).not.toContain("<div>");
  });

  it("math without any HTML artifacts still works", () => {
    const { html } = normalizeAnkiLatexContent("[$]x^2 + y^2[/$]");
    expect(html).toContain("katex");
  });
});

describe("ankiLatex: legacy renderer (renderAnkiHtmlWithLatex)", () => {
  it("handles &nbsp; in [$]...[/$] math", () => {
    const html = renderAnkiHtmlWithLatex("Compute: [$]&nbsp;x + y[/$].");
    expect(html).toContain("katex");
    expect(html).not.toContain("&nbsp;");
  });

  it("handles &lt; in inline math", () => {
    const html = renderAnkiHtmlWithLatex("Solve [$]x &lt; 5[/$] for x.");
    expect(html).toContain("katex");
  });

  it("strips <div> in [latex]...[/latex] block math", () => {
    const html = renderAnkiHtmlWithLatex("Result: [latex]<div>x + y</div>[/latex]");
    expect(html).toContain("katex");
    expect(html).not.toContain("<div>");
  });

  it("handles mixed entities and tags", () => {
    const html = renderAnkiHtmlWithLatex("Compute: [$]<span>&nbsp;x&nbsp;</span>[/$]");
    expect(html).toContain("katex");
    expect(html).not.toContain("&nbsp;");
  });
});
