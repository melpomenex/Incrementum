import { latexToHTML } from "./mathOcr";

const RAW_LATEX_HINT =
  /\\(?:frac|sqrt|sum|prod|int|alpha|beta|gamma|delta|theta|lambda|mu|sigma|omega|pi|leq|geq|neq|approx|times|cdot|to|rightarrow|leftarrow|partial|infty|left|right|mathrm|text|mbox)\b|(?:\^|_)\{[^}]+\}/;

function renderInlineLatex(expression: string): string {
  return latexToHTML(expression.trim());
}

function renderBlockLatex(expression: string): string {
  return `<div class="math-expression-block">${latexToHTML(expression.trim())}</div>`;
}

/**
 * Converts Anki-style LaTeX markers in HTML content to renderable math HTML.
 * This preserves existing HTML while making common Anki math wrappers visible.
 */
export function renderAnkiHtmlWithLatex(content: string): string {
  if (!content) {
    return content;
  }

  const lowered = content.toLowerCase();
  const hasDelimitedLatex =
    lowered.includes("latex") ||
    content.includes("[$") ||
    content.includes("$") ||
    content.includes("\\(") ||
    content.includes("\\[");
  const hasRawLatex = RAW_LATEX_HINT.test(content);
  const hasHtmlTags = /<[a-z!/][^>]*>/i.test(content);

  // Some imported flashcards contain raw LaTeX commands without delimiters.
  // Render the whole field when it looks like math and is plain text.
  if (!hasDelimitedLatex && hasRawLatex && !hasHtmlTags) {
    return renderInlineLatex(content);
  }

  if (!hasDelimitedLatex) {
    return content;
  }

  return content
    // Anki wrappers
    .replace(/\[latex\]([\s\S]*?)\[\/latex\]/gi, (_match, expression) => renderBlockLatex(expression))
    .replace(/\[\$\$\]([\s\S]*?)\[\/\$\$\]/g, (_match, expression) => renderBlockLatex(expression))
    .replace(/\[\$\]([\s\S]*?)\[\/\$\]/g, (_match, expression) => renderInlineLatex(expression))
    // Common LaTeX delimiters
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, expression) => renderBlockLatex(expression))
    .replace(/\$\$([\s\S]*?)\$\$/g, (_match, expression) => renderBlockLatex(expression))
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, expression) => renderInlineLatex(expression))
    // Tolerate mixed delimiters like "$...\\]"
    .replace(/\$([^$\n]*?)\\\]/g, (_match, expression) => renderInlineLatex(expression))
    // Drop orphan latex tags emitted by malformed cards
    .replace(/\[\/latex\]/gi, "")
    .replace(/\[latex\]/gi, "");
}
