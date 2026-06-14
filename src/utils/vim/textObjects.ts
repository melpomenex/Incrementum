/**
 * Vim text-object selection.
 *
 * Text objects (`aw`/`iw`/`as`/`is`/`ap`/`ip`) compute a token range that can
 * be selected immediately (entering visual mode) or fed to an operator.
 *
 * The model is the kind-pure token list from `textModel.ts`:
 *   - "word" tokens are `\w` runs
 *   - "punct" tokens are non-whitespace, non-word runs
 *   - whitespace is implicit between tokens
 *
 * Sentence boundaries: `.`, `!`, `?` followed by whitespace or end of a text
 * node's content. Paragraph boundaries: a gap in Y between visual lines (sourced
 * from `lineGrouper`), matching the existing `{`/`}` paragraph motions.
 */
import type { WordToken } from "./textModel";
import type { LineGroup } from "./lineGrouper";
import { findLineForToken } from "./lineGrouper";

export type TextObjectTarget =
  | "aw"
  | "iw"
  | "as"
  | "is"
  | "ap"
  | "ip";

export interface TextObjectResult {
  /** Inclusive start token index of the selection. */
  startIndex: number;
  /** Inclusive end token index of the selection. */
  endIndex: number;
}

const SENTENCE_END = /[.!?]/;

/** Returns true when `char` ends a sentence (terminal punctuation). */
function isSentenceEnd(char: string | undefined): char is string {
  return !!char && SENTENCE_END.test(char);
}

/**
 * Find the index of the first token whose text node + offset comes strictly
 * before `tokens[anchor]` at or after a sentence boundary.
 */
function findSentenceRange(
  tokens: WordToken[],
  anchor: number,
): { startIndex: number; endIndex: number } {
  if (tokens.length === 0) return { startIndex: 0, endIndex: 0 };
  const clamped = Math.max(0, Math.min(anchor, tokens.length - 1));

  // Walk backward to find the sentence start: either the beginning, or the
  // first token after a sentence-ending token followed by whitespace.
  let startIndex = 0;
  for (let i = clamped - 1; i >= 0; i--) {
    const cur = tokens[i];
    const lastChar = cur.text[cur.text.length - 1];
    if (isSentenceEnd(lastChar)) {
      // This token ends a sentence; the next token starts a new one.
      startIndex = i + 1;
      break;
    }
  }

  // Walk forward to find the sentence end: the token that ends with a
  // sentence terminator, or the last token.
  let endIndex = tokens.length - 1;
  for (let i = clamped; i < tokens.length; i++) {
    const cur = tokens[i];
    const lastChar = cur.text[cur.text.length - 1];
    if (isSentenceEnd(lastChar)) {
      endIndex = i;
      break;
    }
  }
  // If we never found a terminator walking forward from the cursor, the
  // sentence runs to the end; but if the cursor is before the first
  // terminator, look back to include the right sentence.
  if (endIndex < startIndex) endIndex = startIndex;
  return { startIndex, endIndex };
}

/**
 * Find the paragraph range containing the anchor, using the same Y-gap
 * heuristic (>20px) as the `{`/`}` motions in `motions.ts`.
 */
function findParagraphRange(
  tokens: WordToken[],
  anchor: number,
  lines: LineGroup[],
): { startIndex: number; endIndex: number } {
  if (tokens.length === 0 || lines.length === 0) {
    return { startIndex: 0, endIndex: Math.max(0, tokens.length - 1) };
  }
  const clamped = Math.max(0, Math.min(anchor, tokens.length - 1));
  const currentLine = findLineForToken(lines, clamped);
  if (!currentLine) return { startIndex: clamped, endIndex: clamped };

  // Walk backward over line groups, stopping at a paragraph gap.
  let startLineIndex = currentLine.index;
  for (let i = currentLine.index; i > 0; i--) {
    const gap = lines[i].top - lines[i - 1].bottom;
    if (gap > 20) {
      startLineIndex = i;
      break;
    }
    startLineIndex = i - 1;
  }

  // Walk forward over line groups, stopping at a paragraph gap.
  let endLineIndex = currentLine.index;
  for (let i = currentLine.index; i < lines.length - 1; i++) {
    const gap = lines[i + 1].top - lines[i].bottom;
    if (gap > 20) {
      endLineIndex = i;
      break;
    }
    endLineIndex = i + 1;
  }

  const startIndex = lines[startLineIndex].tokens[0].index;
  const endLine = lines[endLineIndex];
  const endIndex = endLine.tokens[endLine.tokens.length - 1].index;
  return { startIndex, endIndex };
}

/**
 * Select a text object around (a) or inside (i) the cursor position.
 * Returns null when the object cannot be resolved (e.g. empty document).
 */
export function selectTextObject(
  tokens: WordToken[],
  cursorIndex: number,
  target: TextObjectTarget,
  lines?: LineGroup[],
): TextObjectResult | null {
  if (tokens.length === 0) return null;
  const cursor = Math.max(0, Math.min(cursorIndex, tokens.length - 1));

  switch (target) {
    case "iw": {
      return { startIndex: cursor, endIndex: cursor };
    }
    case "aw": {
      // Around word: the word plus trailing whitespace (next token if it
      // exists and is a whitespace-gap — i.e. there is a following token).
      const end = cursor + 1 < tokens.length ? cursor + 1 : cursor;
      return { startIndex: cursor, endIndex: end };
    }
    case "is": {
      return findSentenceRange(tokens, cursor);
    }
    case "as": {
      const r = findSentenceRange(tokens, cursor);
      // Include trailing token (whitespace gap) when available.
      const end = r.endIndex + 1 < tokens.length ? r.endIndex + 1 : r.endIndex;
      return { startIndex: r.startIndex, endIndex: end };
    }
    case "ip":
    case "ap": {
      if (!lines || lines.length === 0) {
        // Fallback: treat the whole token list as one paragraph.
        return { startIndex: 0, endIndex: tokens.length - 1 };
      }
      const r = findParagraphRange(tokens, cursor, lines);
      if (target === "ap") {
        // Include the trailing blank line (the line after the paragraph gap
        // if one exists). We approximate by extending the end to the first
        // token of the next paragraph when a gap follows.
        const endLineIndex = lines.findIndex(
          (ln) => ln.tokens[0]?.index === r.endIndex,
        );
        if (endLineIndex >= 0 && endLineIndex + 1 < lines.length) {
          const gap = lines[endLineIndex + 1].top - lines[endLineIndex].bottom;
          if (gap > 20) {
            return { startIndex: r.startIndex, endIndex: r.endIndex + 1 };
          }
        }
      }
      return r;
    }
  }
}
