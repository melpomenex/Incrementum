import { latexToHTML, validateLatex } from "./mathOcr";

const RAW_LATEX_HINT =
  /\\(?:frac|sqrt|sum|prod|int|alpha|beta|gamma|delta|theta|lambda|mu|sigma|omega|pi|leq|geq|neq|approx|times|cdot|to|rightarrow|leftarrow|partial|infty|left|right|mathrm|text|mbox|overrightarrow|overleftarrow|hat|bar|vec|dot|ddot|tilde|underline|overline|overbrace|underbrace|widehat|widetilde|mathbb|mathcal|mathfrak|boldsymbol|vec)\b|(?:\^|_)\{[^}]+\}/;

const POTENTIAL_LATEX_HINT = /\[latex\]|\[\$\$\]|\[\$\]|\$\$|\$|\\\(|\\\[/i;

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
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isLikelyMath(expression: string): boolean {
  const expr = expression.trim();
  if (!expr) return false;
  return /\\[a-zA-Z]+|[=^_{}]|[+\-*/<>]|[α-ωΑ-Ω∫∑∏√∞±×÷≈≠≤≥]/.test(expr);
}

function extractUnsupportedCommands(expression: string): string[] {
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

  // latexToHTML uses KaTeX which handles virtually all LaTeX commands
  const renderedMath = latexToHTML(trimmed);
  return {
    type: mode === "block" ? "math-block" : "math-inline",
    source,
    rendered: mode === "block" ? `<div class="math-expression-block">${renderedMath}</div>` : renderedMath,
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
  const tokens: AnkiLatexNormalizationToken[] = [];
  const unsupportedCommands: string[] = [];
  let output = "";
  let lastIndex = 0;

  // 1:[latex] 2:[$$] 3:[$] 4:\[\] 5:$$ $$ 6:\(\) 7:mixed $...\] 8:$...$
  const tokenRegex = /\[latex\]([\s\S]*?)\[\/latex\]|\[\$\$\]([\s\S]*?)\[\/\$\$\]|\[\$\]([\s\S]*?)\[\/\$\]|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\\\(([\s\S]*?)\\\)|\$([^$\n]*?)\\\]|\$([^$\n]+?)\$/gi;

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(protectedText)) !== null) {
    if (match.index > lastIndex) {
      const textSegment = protectedText.slice(lastIndex, match.index);
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
    );

    tokens.push(token);
    output += token.rendered;
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < protectedText.length) {
    const trailing = protectedText.slice(lastIndex);
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
    .replace(/\[latex\]([\s\S]*?)\[\/latex\]/gi, (_match, expression) => `<div class="math-expression-block">${latexToHTML(expression.trim())}</div>`)
    .replace(/\[\$\$\]([\s\S]*?)\[\/\$\$\]/g, (_match, expression) => `<div class="math-expression-block">${latexToHTML(expression.trim())}</div>`)
    .replace(/\[\$\]([\s\S]*?)\[\/\$\]/g, (_match, expression) => latexToHTML(expression.trim()))
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, expression) => `<div class="math-expression-block">${latexToHTML(expression.trim())}</div>`)
    .replace(/\$\$([\s\S]*?)\$\$/g, (_match, expression) => `<div class="math-expression-block">${latexToHTML(expression.trim())}</div>`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, expression) => latexToHTML(expression.trim()))
    .replace(/\$([^$\n]*?)\\\]/g, (_match, expression) => latexToHTML(expression.trim()))
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
              type: "text",
              source,
              rendered: source,
              fallback: false,
            },
          ],
          hasFallback: false,
          unsupportedCommands: [],
        };

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

  if (!isAnkiLatexNormalizationEnabled()) {
    return legacyRenderAnkiHtmlWithLatex(content);
  }

  try {
    return normalizeAnkiLatexContent(content).html;
  } catch (error) {
    console.warn("[anki-latex] normalization-failed, falling back to legacy renderer", error);
    return legacyRenderAnkiHtmlWithLatex(content);
  }
}
