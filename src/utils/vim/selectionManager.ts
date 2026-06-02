import type { WordToken } from "./textModel";

export function setSelection(
  doc: Document,
  anchorIndex: number,
  cursorIndex: number,
  tokens: WordToken[],
): void {
  if (tokens.length === 0) return;

  const startIdx = Math.min(anchorIndex, cursorIndex);
  const endIdx = Math.max(anchorIndex, cursorIndex);

  const startToken = tokens[startIdx];
  const endToken = tokens[endIdx];
  if (!startToken || !endToken) return;

  const sel = doc.getSelection();
  if (!sel) return;

  try {
    const range = doc.createRange();
    range.setStart(startToken.node, startToken.startOffset);
    range.setEnd(endToken.node, endToken.endOffset);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // Range may fail if nodes were modified by caret overlay
  }
}

export function clearSelection(doc: Document): void {
  const sel = doc.getSelection();
  if (sel) sel.removeAllRanges();
}

export function getSelectedText(doc: Document): string {
  return doc.getSelection()?.toString() ?? "";
}
