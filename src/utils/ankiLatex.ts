import { latexToHTML } from "./mathOcr";
import { MacroExpander } from "./latexMacros";
import DOMPurify from "dompurify";

const RAW_LATEX_HINT =
  /\\(?:frac|sqrt|sum|prod|int|alpha|beta|gamma|delta|theta|lambda|mu|sigma|omega|pi|leq|geq|neq|approx|times|cdot|to|rightarrow|leftarrow|partial|infty|left|right|mathrm|text|mbox|overrightarrow|overleftarrow|hat|bar|vec|dot|ddot|tilde|underline|overline|overbrace|underbrace|widehat|widetilde|mathbb|mathcal|mathfrak|boldsymbol|newcommand|renewcommand|DeclareMathOperator|ce|pu|operatorname|sin|cos|tan|log|ln|exp|lim|sup|inf|min|max|in|notin|subset|cup|cap|setminus|exists|forall|nabla|cdot|pm|equiv|sim|simeq|perp|angle|triangle|square|cong|propto|oplus|otimes|bigcup|bigcap|bigsqcup|binom|dfrac|tfrac|cfrac|mathrm|mathbf|mathit|mathsf|mathtt|mathscr|mathfrak|boldsymbol|coloneqq|coloneq)(?![a-zA-Z])|(?:\^|_)\{[^}]+\}|\\[a-zA-Z]+[{_]|\\[a-zA-Z]+$/;

const POTENTIAL_LATEX_HINT = /\[latex\]|\[\$\$\]|\[\$\]|\$\$|\$|\\\(|\\\[|\\\$|\\newcommand|\\DeclareMathOperator/i;

const SUPPORTED_LATEX_COMMANDS = new Set<string>([
  "frac",
  "sqrt",
  "sum",
  "prod",
  "int",
  "alpha",
  "beta",
  "gamma",
  "delta",
  "theta",
  "lambda",
  "mu",
  "sigma",
  "omega",
  "phi",
  "rho",
  "pi",
  "infty",
  "cdot",
  "times",
  "pm",
  "leq",
  "geq",
  "neq",
  "approx",
  "propto",
  "to",
  "rightarrow",
  "leftarrow",
  "partial",
  "in",
  "sin",
  "cos",
  "tan",
  "begin",
  "end",
  "item",
  "left",
  "right",
  "text",
  "mbox",
  "textrm",
  "mathrm",
  "mathbf",
  "mathit",
  "overrightarrow",
  "overleftarrow",
  "hat",
  "bar",
  "vec",
  "dot",
  "ddot",
  "tilde",
  "underline",
  "overline",
  "overbrace",
  "underbrace",
  "widehat",
  "widetilde",
  "mathbb",
  "mathcal",
  "mathfrak",
  "boldsymbol",
  "operatorname",
  "ce",
  "pu",
  "newcommand",
  "renewcommand",
  "DeclareMathOperator",
  "quad",
  "qquad",
  ",",
  ";",
  ":",
  "!",
]);

const NORMALIZATION_CACHE = new Map<string, AnkiLatexNormalizationResult>();
const MAX_CACHE_ENTRIES = 1000;
const FALLBACK_TELEMETRY_LOGGED = new Set<string>();

type MathMode = "inline" | "block";

interface ProtectedSegment {
  placeholder: string;
  value: string;
}

export interface AnkiLatexNormalizationToken {
  type: "text" | "math-inline" | "math-block";
  source: string;
  rendered: string;
  fallback: boolean;
  fallbackReason?: string;
}

export interface AnkiLatexNormalizationResult {
  source: string;
  html: string;
  tokens: AnkiLatexNormalizationToken[];
  hasFallback: boolean;
  unsupportedCommands: string[];
}

export interface AnkiLatexFieldNormalization {
  question?: AnkiLatexNormalizationResult;
  answer?: AnkiLatexNormalizationResult;
  clozeText?: AnkiLatexNormalizationResult;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Decode HTML entities that Anki stores inside math delimiters.
 * KaTeX does not understand HTML entities — it expects raw characters.
 *
 * Common entities from Anki decks:
 *   &nbsp; → space (non-breaking space has no meaning in math mode)
 *   &amp;  → &
 *   &lt;   → <
 *   &gt;   → >
 *   &quot; → "
 *   &#39;  → '
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Strip structural HTML tags that Anki inserts inside math delimiters.
 * These break KaTeX parsing. Only math-relevant tags (like <sub>, <sup>) are kept
 * by converting them to their LaTeX equivalents.
 */
function stripHtmlFromMath(text: string): string {
  return text
    .replace(/<div[^>]*>/gi, " ")
    .replace(/<\/div>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/<p[^>]*>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<hr[^>]*>/gi, " ")
    .replace(/<\/hr>/gi, " ")
    .replace(/<em[^>]*>/gi, "")
    .replace(/<\/em>/gi, "")
    .replace(/<i[^>]*>/gi, "")
    .replace(/<\/i>/gi, "")
    .replace(/<strong[^>]*>/gi, "")
    .replace(/<\/strong>/gi, "")
    .replace(/<b[^>]*>/gi, "")
    .replace(/<\/b>/gi, "")
    // Collapse multiple spaces to one (LaTeX ignores extra spaces)
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isLikelyMath(expression: string): boolean {
  const expr = expression.trim();
  if (!expr) return false;
  return /\\[a-zA-Z]+|[=^_{}]|[+\-*/<>]|[α-ωΑ-Ω∫∑∏√∞±×÷≈≠≤≥]/.test(expr);
}

function _extractUnsupportedCommands(expression: string): string[] {
  const unsupported = new Set<string>();
  const commandRegex = /\\([a-zA-Z]+)\b/g;
  let match: RegExpExecArray | null;
  while ((match = commandRegex.exec(expression)) !== null) {
    const command = match[1];
    if (!SUPPORTED_LATEX_COMMANDS.has(command)) {
      unsupported.add(command);
    }
  }
  return Array.from(unsupported);
}

function protectCodeSegments(content: string): { text: string; segments: ProtectedSegment[] } {
  const segments: ProtectedSegment[] = [];

  const protect = (input: string, pattern: RegExp): string => {
    return input.replace(pattern, (fullMatch) => {
      const index = segments.length;
      const placeholder = `@@ANKI_LATEX_PROTECTED_${index}@@`;
      segments.push({ placeholder, value: fullMatch });
      return placeholder;
    });
  };

  let text = content;
  text = protect(text, /<pre\b[^>]*>[\s\S]*?<\/pre>/gi);
  text = protect(text, /<code\b[^>]*>[\s\S]*?<\/code>/gi);
  text = protect(text, /```[\s\S]*?```/g);
  text = protect(text, /`[^`\n]+`/g);

  return { text, segments };
}

function restoreProtectedSegments(content: string, segments: ProtectedSegment[]): string {
  let restored = content;
  for (const segment of segments) {
    restored = restored.replaceAll(segment.placeholder, segment.value);
  }
  return restored;
}

function renderMathToken(
  expression: string,
  mode: MathMode,
  source: string,
  _unsupportedCommands: string[],
  macros: MacroExpander,
): AnkiLatexNormalizationToken {
  const trimmed = expression.trim();

  if (!trimmed) {
    const fallbackHtml = `<span class="math-expression-fallback" data-latex-fallback="true" data-latex-reason="empty-expression">${escapeHtml(trimmed)}</span>`;
    return {
      type: mode === "block" ? "math-block" : "math-inline",
      source,
      rendered: mode === "block" ? `<div class="math-expression-block">${fallbackHtml}</div>` : fallbackHtml,
      fallback: true,
      fallbackReason: "empty-expression",
    };
  }

  // Anki decks often store HTML entities and structural tags inside math delimiters.
  // KaTeX does not understand HTML — decode entities and strip tags first.
  const decoded = decodeHtmlEntities(trimmed);
  const cleaned = stripHtmlFromMath(decoded);

  // latexToHTML uses KaTeX which handles virtually all LaTeX commands
  // Block mode always uses display mode; inline mode auto-detects display-only environments
  const renderedMath = latexToHTML(cleaned, {
    displayMode: mode === "block" ? true : undefined,
    macros,
  });

  // If auto-detected display mode produced block-level output, upgrade token type
  const isDisplayAutoUpgrade = mode === "inline" && renderedMath.includes("math-expression-block");
  const tokenType = isDisplayAutoUpgrade ? "math-block" : mode === "block" ? "math-block" : "math-inline";
  const rendered = tokenType === "math-block" && !renderedMath.includes("math-expression-block")
    ? `<div class="math-expression-block">${renderedMath}</div>`
    : renderedMath;

  return {
    type: tokenType,
    source,
    rendered,
    fallback: false,
  };
}

function maybeLogFallbackTelemetry(result: AnkiLatexNormalizationResult): void {
  if (!result.hasFallback) return;
  const key = `${result.unsupportedCommands.sort().join(",")}:${result.tokens.filter((token) => token.fallback).length}`;
  if (FALLBACK_TELEMETRY_LOGGED.has(key)) return;
  FALLBACK_TELEMETRY_LOGGED.add(key);
  console.warn("[anki-latex] fallback-render", {
    fallbackCount: result.tokens.filter((token) => token.fallback).length,
    unsupportedCommands: result.unsupportedCommands,
  });
}

function parseWithTokenizer(content: string): AnkiLatexNormalizationResult {
  const { text: protectedText, segments } = protectCodeSegments(content);

  // Process macro definitions first (before delimiter tokenization)
  const macros = new MacroExpander();
  const textWithMacrosProcessed = macros.parseDefinitions(protectedText);

  // Replace escaped dollar signs to prevent them from being treated as delimiters
  const escapedDollarSegments: string[] = [];
  const textWithEscapedDollars = textWithMacrosProcessed.replace(/\\\$/g, (_match) => {
    const index = escapedDollarSegments.length;
    escapedDollarSegments.push("$");
    return `@@ESCAPED_DOLLAR_${index}@@`;
  });

  const tokens: AnkiLatexNormalizationToken[] = [];
  const unsupportedCommands: string[] = [];
  let output = "";
  let lastIndex = 0;

  // 1:[latex] 2:[$$] 3:[$] 4:\[\] 5:$$ $$ 6:\(\) 7:mixed $...\] 8:$...$
  const tokenRegex = /\[latex\]([\s\S]*?)\[\/latex\]|\[\$\$\]([\s\S]*?)\[\/\$\$\]|\[\$\]([\s\S]*?)\[\/\$\]|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\\\(([\s\S]*?)\\\)|\$([^$\n]*?)\\\]|\$([^$\n]+?)\$/gi;

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(textWithEscapedDollars)) !== null) {
    if (match.index > lastIndex) {
      const textSegment = textWithEscapedDollars.slice(lastIndex, match.index);
      tokens.push({
        type: "text",
        source: textSegment,
        rendered: textSegment,
        fallback: false,
      });
      output += textSegment;
    }

    const source = match[0];
    const blockExpression = match[1] ?? match[2] ?? match[4] ?? match[5];
    const inlineExpression = match[3] ?? match[6] ?? match[7] ?? match[8];

    if (inlineExpression !== undefined && match[8] !== undefined && !isLikelyMath(inlineExpression)) {
      tokens.push({
        type: "text",
        source,
        rendered: source,
        fallback: false,
      });
      output += source;
      lastIndex = tokenRegex.lastIndex;
      continue;
    }

    const token = renderMathToken(
      blockExpression ?? inlineExpression ?? "",
      blockExpression !== undefined ? "block" : "inline",
      source,
      unsupportedCommands,
      macros,
    );

    tokens.push(token);
    output += token.rendered;
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < textWithEscapedDollars.length) {
    const trailing = textWithEscapedDollars.slice(lastIndex);
    tokens.push({
      type: "text",
      source: trailing,
      rendered: trailing,
      fallback: false,
    });
    output += trailing;
  }

  // Drop orphan tags emitted by malformed cards
  output = output.replace(/\[\/latex\]/gi, "").replace(/\[latex\]/gi, "");
  output = restoreProtectedSegments(output, segments);

  // Restore escaped dollar signs
  escapedDollarSegments.forEach((dollar, index) => {
    output = output.replaceAll(`@@ESCAPED_DOLLAR_${index}@@`, dollar);
  });

  const dedupUnsupported = Array.from(new Set(unsupportedCommands));
  const result: AnkiLatexNormalizationResult = {
    source: content,
    html: output,
    tokens,
    hasFallback: tokens.some((token) => token.fallback),
    unsupportedCommands: dedupUnsupported,
  };

  maybeLogFallbackTelemetry(result);
  return result;
}

function legacyRenderAnkiHtmlWithLatex(content: string): string {
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

  if (!hasDelimitedLatex && hasRawLatex && !hasHtmlTags) {
    return latexToHTML(content.trim());
  }

  if (!hasDelimitedLatex) {
    return content;
  }

  return content
    .replace(/\[latex\]([\s\S]*?)\[\/latex\]/gi, (_match, expression) => `<div class="math-expression-block">${latexToHTML(stripHtmlFromMath(decodeHtmlEntities(expression.trim())))}</div>`)
    .replace(/\[\$\$\]([\s\S]*?)\[\/\$\$\]/g, (_match, expression) => `<div class="math-expression-block">${latexToHTML(stripHtmlFromMath(decodeHtmlEntities(expression.trim())))}</div>`)
    .replace(/\[\$\]([\s\S]*?)\[\/\$\]/g, (_match, expression) => latexToHTML(stripHtmlFromMath(decodeHtmlEntities(expression.trim()))))
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, expression) => `<div class="math-expression-block">${latexToHTML(stripHtmlFromMath(decodeHtmlEntities(expression.trim())))}</div>`)
    .replace(/\$\$([\s\S]*?)\$\$/g, (_match, expression) => `<div class="math-expression-block">${latexToHTML(stripHtmlFromMath(decodeHtmlEntities(expression.trim())))}</div>`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, expression) => latexToHTML(stripHtmlFromMath(decodeHtmlEntities(expression.trim()))))
    .replace(/\$([^$\n]*?)\\\]/g, (_match, expression) => latexToHTML(stripHtmlFromMath(decodeHtmlEntities(expression.trim()))))
    .replace(/\[\/latex\]/gi, "")
    .replace(/\[latex\]/gi, "");
}

export function isAnkiLatexNormalizationEnabled(): boolean {
  const flag = import.meta.env.VITE_ENABLE_ANKI_LATEX_NORMALIZATION;
  return flag !== "0" && flag !== "false";
}

export function normalizeAnkiLatexContent(content: string): AnkiLatexNormalizationResult {
  const source = content || "";
  const cacheKey = source;
  const cached = NORMALIZATION_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (!source) {
    const emptyResult: AnkiLatexNormalizationResult = {
      source,
      html: source,
      tokens: [],
      hasFallback: false,
      unsupportedCommands: [],
    };
    NORMALIZATION_CACHE.set(cacheKey, emptyResult);
    return emptyResult;
  }

  const hasPotentialLatex = POTENTIAL_LATEX_HINT.test(source);
  const hasRawLatex = RAW_LATEX_HINT.test(source);
  const hasHtmlTags = /<[a-z!/][^>]*>/i.test(source);

  const result = !hasPotentialLatex && hasRawLatex && !hasHtmlTags
    ? parseWithTokenizer(`[$]${source}[/$]`)
    : hasPotentialLatex || hasRawLatex
      ? parseWithTokenizer(source)
      : {
          source,
          html: source,
          tokens: [
            {
              type: "text" as const,
              source,
              rendered: source,
              fallback: false,
            },
          ],
          hasFallback: false,
          unsupportedCommands: [],
        };

  // If tokenizer found no math tokens but raw LaTeX is present after macro processing,
  // render the whole content as math (handles bare LaTeX like "\newcommand...\R")
  if (
    !result.tokens.some((t) => t.type === "math-inline" || t.type === "math-block") &&
    RAW_LATEX_HINT.test(result.html) &&
    !hasHtmlTags
  ) {
    return parseWithTokenizer(`[$]${result.html}[/$]`);
  }

  if (NORMALIZATION_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = NORMALIZATION_CACHE.keys().next().value;
    if (oldestKey) NORMALIZATION_CACHE.delete(oldestKey);
  }
  NORMALIZATION_CACHE.set(cacheKey, result);
  return result;
}

export function normalizeAnkiFlashcardFields(fields: {
  question?: string;
  answer?: string;
  clozeText?: string;
}): AnkiLatexFieldNormalization {
  const result: AnkiLatexFieldNormalization = {};
  if (fields.question) {
    result.question = normalizeAnkiLatexContent(fields.question);
  }
  if (fields.answer) {
    result.answer = normalizeAnkiLatexContent(fields.answer);
  }
  if (fields.clozeText) {
    result.clozeText = normalizeAnkiLatexContent(fields.clozeText);
  }
  return result;
}

export function warmAnkiLatexNormalization(fields: Array<string | undefined | null>): void {
  for (const field of fields) {
    if (typeof field !== "string" || field.trim().length === 0) continue;
    normalizeAnkiLatexContent(field);
  }
}

export function reprocessAnkiLatexContent(content: string): AnkiLatexNormalizationResult {
  NORMALIZATION_CACHE.delete(content || "");
  return normalizeAnkiLatexContent(content);
}

/**
 * Converts Anki-style LaTeX markers in flashcard content to renderable math HTML.
 * Uses the normalization contract when enabled and legacy mode when disabled.
 */
export function renderAnkiHtmlWithLatex(content: string): string {
  if (!content) {
    return content;
  }

  let html: string;
  if (!isAnkiLatexNormalizationEnabled()) {
    html = legacyRenderAnkiHtmlWithLatex(content);
  } else {
    try {
      html = normalizeAnkiLatexContent(content).html;
    } catch (error) {
      console.warn("[anki-latex] normalization-failed, falling back to legacy renderer", error);
      html = legacyRenderAnkiHtmlWithLatex(content);
    }
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr", "pre", "blockquote",
      "b", "i", "em", "strong", "u", "s", "del", "ins", "mark", "small", "sub", "sup", "abbr",
      "ul", "ol", "li", "dl", "dt", "dd",
      "a", "img",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
      "figure", "figcaption", "details", "summary", "aside", "article", "section", "header", "footer", "nav",
      "div", "span", "main",
      "audio", "video", "source", "track",
      "time", "ruby", "rt", "rp",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "class", "id", "style",
      "width", "height", "loading", "decoding", "target", "rel",
      "colspan", "rowspan", "headers", "scope", "nowrap",
      "start", "reversed", "type", "value",
      "datetime", "cite", "lang", "dir", "tabindex", "role",
      "aria-label", "aria-labelledby", "aria-describedby", "aria-hidden", "aria-expanded",
      "controls", "autoplay", "loop", "muted", "preload", "poster",
      "open", "name", "data-*",
    ],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "applet", "form", "input", "button", "textarea", "select", "base", "link", "meta"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "onsubmit", "onaction"],
  }) as string;
}
