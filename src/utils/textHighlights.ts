import { normalizeHighlightColor } from "./highlightColors";
import type { TextSelectionContext } from "../types/selection";

export interface AnchoredTextHighlight {
  id: string;
  startOffset: number;
  endOffset: number;
  color?: string | null;
  title?: string;
}

interface TextNodeEntry {
  node: Text;
  start: number;
  end: number;
}

export function buildTextSelectionContext(params: {
  root: HTMLElement;
  range: Range;
  documentId: string;
  surface: TextSelectionContext["surface"];
  extractId?: string;
}): TextSelectionContext | null {
  const { root, range, documentId, surface, extractId } = params;
  if (!root.contains(range.commonAncestorContainer)) {
    return null;
  }

  const probe = document.createRange();
  probe.selectNodeContents(root);
  probe.setEnd(range.startContainer, range.startOffset);
  const startOffset = probe.toString().length;

  const probeEnd = document.createRange();
  probeEnd.selectNodeContents(root);
  probeEnd.setEnd(range.endContainer, range.endOffset);
  const endOffset = probeEnd.toString().length;

  const selectedText = range.toString().trim();
  if (!selectedText || endOffset <= startOffset) {
    return null;
  }

  return {
    type: "text",
    surface,
    documentId,
    extractId,
    startOffset,
    endOffset,
    selectedText,
  };
}

function collectTextNodes(root: HTMLElement): TextNodeEntry[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT;
      if (!node.textContent || node.textContent.length === 0) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-highlight-wrapper='true']")) return NodeFilter.FILTER_REJECT;
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const entries: TextNodeEntry[] = [];
  let offset = 0;
  let current = walker.nextNode();
  while (current) {
    const textNode = current as Text;
    const length = textNode.textContent?.length ?? 0;
    entries.push({ node: textNode, start: offset, end: offset + length });
    offset += length;
    current = walker.nextNode();
  }
  return entries;
}

function wrapTextNodeRange(node: Text, start: number, end: number, id: string, color?: string | null, title?: string) {
  const text = node.textContent ?? "";
  if (start >= end || start < 0 || end > text.length) return;

  const before = text.slice(0, start);
  const middle = text.slice(start, end);
  const after = text.slice(end);
  const fragment = document.createDocumentFragment();

  if (before) {
    fragment.appendChild(document.createTextNode(before));
  }

  const wrapper = document.createElement("mark");
  wrapper.dataset.highlightWrapper = "true";
  wrapper.dataset.highlightId = id;
  wrapper.className = "persisted-text-highlight";
  wrapper.style.backgroundColor = normalizeHighlightColor(color);
  wrapper.style.padding = "0";
  wrapper.style.borderRadius = "0.12rem";
  if (title) {
    wrapper.title = title;
  }
  wrapper.textContent = middle;
  fragment.appendChild(wrapper);

  if (after) {
    fragment.appendChild(document.createTextNode(after));
  }

  node.replaceWith(fragment);
}

/**
 * Remove all existing highlight marks, unwrapping their text content back
 * into the parent. This modifies the DOM in place without changing the
 * rendered text — no visual flash.
 */
function removeAllHighlightMarks(root: HTMLElement) {
  const marks = root.querySelectorAll("mark[data-highlight-wrapper='true']");
  for (const mark of marks) {
    const text = mark.textContent ?? "";
    const parent = mark.parentNode;
    if (!parent) continue;
    const textNode = document.createTextNode(text);
    parent.replaceChild(textNode, mark);
    parent.normalize(); // merge adjacent text nodes
  }
}

export function applyAnchoredTextHighlights(params: {
  root: HTMLElement | null;
  highlights: AnchoredTextHighlight[];
  signature: string;
}) {
  const { root, highlights, signature } = params;
  if (!root) return;

  if (root.dataset.highlightSignature !== signature) {
    // Document content changed — need full reset
    root.dataset.highlightSignature = signature;
    root.dataset.highlightOriginalHtml = root.innerHTML;
    // When content changes, existing marks are invalid (offsets shifted)
    removeAllHighlightMarks(root);
  }

  const desiredIds = new Set(
    highlights.filter((h) => h.endOffset > h.startOffset).map((h) => h.id),
  );

  // Check if anything changed by comparing with current marks in the DOM
  const currentMarks = root.querySelectorAll<HTMLElement>("mark[data-highlight-wrapper='true']");
  const currentIds = new Set<string>();
  for (const mark of currentMarks) {
    const id = mark.dataset.highlightId ?? "";
    if (id) currentIds.add(id);
  }

  // If desired and current are identical, nothing to do
  if (desiredIds.size === currentIds.size && [...desiredIds].every((id) => currentIds.has(id))) {
    return;
  }

  for (const mark of currentMarks) {
    const id = mark.dataset.highlightId ?? "";
    if (!desiredIds.has(id)) {
      const text = mark.textContent ?? "";
      const parent = mark.parentNode;
      if (!parent) continue;
      const textNode = document.createTextNode(text);
      parent.replaceChild(textNode, mark);
      parent.normalize();
    }
  }

  // Remove highlights whose color/title changed (will be re-added below)
  const highlightMap = new Map(highlights.filter((h) => h.endOffset > h.startOffset).map((h) => [h.id, h]));
  const staleMarks = root.querySelectorAll<HTMLElement>("mark[data-highlight-wrapper='true']");
  for (const mark of staleMarks) {
    const id = mark.dataset.highlightId ?? "";
    const hl = highlightMap.get(id);
    if (hl) {
      const colorChanged = normalizeHighlightColor(hl.color) !== mark.style.backgroundColor;
      const titleChanged = (hl.title ?? "") !== (mark.title ?? "");
      if (colorChanged || titleChanged) {
        const text = mark.textContent ?? "";
        const parent = mark.parentNode;
        if (!parent) continue;
        const textNode = document.createTextNode(text);
        parent.replaceChild(textNode, mark);
        parent.normalize();
      }
    }
  }

  // Add new highlights
  const existingIds = new Set(
    [...root.querySelectorAll<HTMLElement>("mark[data-highlight-wrapper='true']")].map(
      (m) => m.dataset.highlightId ?? "",
    ).filter(Boolean),
  );

  const toAdd = highlights.filter(
    (h) => h.endOffset > h.startOffset && !existingIds.has(h.id),
  );

  if (toAdd.length === 0) return;

  const textNodes = collectTextNodes(root);
  const sorted = [...toAdd].sort((a, b) => {
    if (a.startOffset !== b.startOffset) return b.startOffset - a.startOffset;
    return b.endOffset - a.endOffset;
  });

  for (const highlight of sorted) {
    const intersecting = textNodes.filter(
      (entry) => entry.end > highlight.startOffset && entry.start < highlight.endOffset,
    );

    for (let index = intersecting.length - 1; index >= 0; index -= 1) {
      const entry = intersecting[index];
      if (!entry.node.isConnected) continue;

      const localStart = Math.max(0, highlight.startOffset - entry.start);
      const localEnd = Math.min((entry.node.textContent ?? "").length, highlight.endOffset - entry.start);
      wrapTextNodeRange(entry.node, localStart, localEnd, highlight.id, highlight.color, highlight.title);
    }
  }

  // Stamp IDs on newly created marks
  // (IDs are now set directly in wrapTextNodeRange, nothing to do here)
}
