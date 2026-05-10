import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Document } from "../../types";
import { renderMarkdown } from "../../utils/markdown";
import { useI18n } from "../../lib/i18n";
import { Sparkles } from "lucide-react";
import type { SelectionContext } from "../../types/selection";
import { applyAnchoredTextHighlights, buildTextSelectionContext, type AnchoredTextHighlight } from "../../utils/textHighlights";

interface MarkdownViewerProps {
  document: Document;
  content?: string;
  /** Initial scroll percent to restore (0-100) */
  initialScrollPercent?: number;
  highlightQuery?: string;
  initialSearchTextQuote?: string;
  searchQuery?: string;
  activeSearchMatchIndex?: number;
  onSearchResultsChange?: (totalMatches: number, activeMatchIndex: number) => void;
  /** Callback when scroll position changes */
  onScrollPositionChange?: (scrollPercent: number) => void;
  highlights?: AnchoredTextHighlight[];
  onSelectionChange?: (text: string, context?: SelectionContext | null) => void;
  onCreateFlashcard?: (excerpt: string) => void;
  /** Callback when user right-clicks on selected text */
  onContextMenu?: (event: { x: number; y: number; selectedText: string; selectionContext?: any }) => void;
}

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeMatchIndex(index: number, total: number): number {
  if (total <= 0) return -1;
  return ((index % total) + total) % total;
}

export function MarkdownViewer({
  document,
  content,
  initialScrollPercent,
  highlightQuery,
  initialSearchTextQuote,
  searchQuery,
  activeSearchMatchIndex,
  onSearchResultsChange,
  onScrollPositionChange,
  highlights = [],
  onSelectionChange,
  onCreateFlashcard,
  onContextMenu,
}: MarkdownViewerProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);
  const hasRestoredRef = useRef(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; selectedText: string } | null>(null);

  // Render markdown with bundle image support
  const html = useMemo(() => {
    if (!content) return "";

    // Check if this document has bundle images
    const hasBundleImages = document.metadata?.hasBundleImages;
    const imageManifest = document.metadata?.bundleImages;

    return renderMarkdown(content, {
      docId: hasBundleImages ? document.id : undefined,
      imageManifest,
    });
  }, [content, document.id, document.metadata?.hasBundleImages, document.metadata?.bundleImages]);

  // Restore scroll position on mount
  useEffect(() => {
    if (
      !containerRef.current ||
      hasRestoredRef.current ||
      initialScrollPercent === undefined ||
      initialScrollPercent === null
    ) {
      return;
    }

    hasRestoredRef.current = true;
    isRestoringRef.current = true;

    // Use requestAnimationFrame to ensure content is rendered
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      const targetScroll = (initialScrollPercent / 100) * maxScroll;

      container.scrollTop = targetScroll;

      // Reset restoration flag after a short delay
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 100);
    });
  }, [initialScrollPercent]);

  // Track scroll position with debouncing
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback(() => {
    if (isRestoringRef.current || !onScrollPositionChange) return;

    // Clear previous timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce scroll updates
    scrollTimeoutRef.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollTop = container.scrollTop;

      if (scrollHeight <= clientHeight) return;

      const maxScroll = scrollHeight - clientHeight;
      const scrollPercent = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;

      onScrollPositionChange(Math.round(scrollPercent * 100) / 100);
    }, 150);
  }, [onScrollPositionChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    applyAnchoredTextHighlights({
      root: contentRef.current,
      highlights,
      signature: `${document.id}:${content ?? ""}`,
    });
  }, [content, document.id, highlights, html]);

  // Store callback in a ref so the highlighting effect doesn't re-run when
  // the parent re-renders with a new inline function reference.
  const onSearchResultsChangeRef = useRef(onSearchResultsChange);
  onSearchResultsChangeRef.current = onSearchResultsChange;

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const signature = `${document.id}:${content ?? ""}:${highlights.length}`;
    const signatureChanged = root.dataset.searchHighlightSignature !== signature;
    if (signatureChanged) {
      root.dataset.searchHighlightSignature = signature;
      root.dataset.searchHighlightOriginalHtml = root.innerHTML;
    }

    // Only reset innerHTML when the underlying content actually changed.
    // A stale innerHTML assignment destroys the browser text selection even
    // when the HTML string is identical (new DOM nodes replace the ones the
    // Selection is anchored to).  This was the root cause of selections
    // vanishing before the user could right-click to create a flashcard.
    if (signatureChanged) {
      root.innerHTML = root.dataset.searchHighlightOriginalHtml ?? root.innerHTML;
    }

    const query = searchQuery?.trim() || highlightQuery?.trim();
    if (!query) {
      onSearchResultsChangeRef.current?.(0, -1);
      return;
    }

    const terms = Array.from(new Set(query.split(/\s+/).map((term) => term.trim()).filter(Boolean))).slice(0, 8);
    if (terms.length === 0) {
      onSearchResultsChangeRef.current?.(0, -1);
      return;
    }

    const escaped = terms.map(escapeRegex);
    const regex = new RegExp(`(${escaped.join("|")})`, "gi");
    const browserDocument = window.document;
    const walker = browserDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      if (node.parentElement?.closest("[data-highlight-wrapper='true']")) continue;
      textNodes.push(node);
    }

    for (const node of textNodes) {
      const value = node.nodeValue ?? "";
      if (!regex.test(value)) continue;
      regex.lastIndex = 0;
      const frag = browserDocument.createDocumentFragment();
      let last = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(value)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (start > last) frag.append(value.slice(last, start));
        const mark = browserDocument.createElement("mark");
        mark.setAttribute("data-search-highlight", "true");
        mark.style.background = "rgba(245, 158, 11, 0.35)";
        mark.style.borderRadius = "2px";
        mark.textContent = value.slice(start, end);
        frag.append(mark);
        last = end;
      }

      if (last < value.length) frag.append(value.slice(last));
      node.parentNode?.replaceChild(frag, node);
    }

    const marks = Array.from(root.querySelectorAll("mark[data-search-highlight='true']")) as HTMLElement[];
    if (marks.length === 0) {
      onSearchResultsChangeRef.current?.(0, -1);
      return;
    }

    const normalizedQuote = initialSearchTextQuote?.trim().toLowerCase();
    const quoteMatchIndex = normalizedQuote
      ? marks.findIndex((mark) => (mark.textContent ?? "").trim().toLowerCase() === normalizedQuote)
      : -1;
    const quotePartialMatchIndex =
      quoteMatchIndex >= 0 || !normalizedQuote
        ? -1
        : marks.findIndex((mark) => (mark.textContent ?? "").trim().toLowerCase().includes(normalizedQuote));

    const defaultActiveIndex =
      quoteMatchIndex >= 0 ? quoteMatchIndex : quotePartialMatchIndex >= 0 ? quotePartialMatchIndex : 0;
    const resolvedActiveIndex = normalizeMatchIndex(activeSearchMatchIndex ?? defaultActiveIndex, marks.length);
    const activeMark = marks[resolvedActiveIndex];

    marks.forEach((mark, index) => {
      const isActive = index === resolvedActiveIndex;
      mark.setAttribute("data-search-active", isActive ? "true" : "false");
      mark.style.background = isActive ? "rgba(249, 115, 22, 0.55)" : "rgba(245, 158, 11, 0.35)";
      mark.style.borderRadius = "2px";
      mark.style.boxShadow = isActive ? "0 0 0 1px rgba(194, 65, 12, 0.35)" : "none";
    });

    onSearchResultsChangeRef.current?.(marks.length, resolvedActiveIndex);
    activeMark?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
  }, [
    activeSearchMatchIndex,
    content,
    document.id,
    highlightQuery,
    highlights.length,
    initialSearchTextQuote,
    searchQuery,
  ]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container || !onSelectionChange) return;

    const publishSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        onSelectionChange("", null);
        return;
      }

      const range = selection.getRangeAt(0);
      const context = buildTextSelectionContext({
        root: container,
        range,
        documentId: document.id,
        surface: "markdown",
      });
      onSelectionChange(context?.selectedText ?? "", context);
    };

    container.addEventListener("mouseup", publishSelection);
    container.addEventListener("keyup", publishSelection);
    return () => {
      container.removeEventListener("mouseup", publishSelection);
      container.removeEventListener("keyup", publishSelection);
    };
  }, [document.id, onSelectionChange]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;
    e.preventDefault();
    const selectedText = selection.toString().trim();
    if (onContextMenu) {
      onContextMenu({ x: e.clientX, y: e.clientY, selectedText });
    } else if (onCreateFlashcard) {
      setContextMenu({ x: e.clientX, y: e.clientY, selectedText });
    }
  }, [onContextMenu, onCreateFlashcard]);

  return (
    <>
    <div
      ref={containerRef}
      data-document-scroll-container
      className="markdown-viewer prose prose-sm max-w-none dark:prose-invert reading-prose overflow-y-auto overflow-x-hidden h-full"
      onScroll={handleScroll}
      onContextMenu={handleContextMenu}
    >
      <h1 className="reading-title">{document.title}</h1>
      {content ? (
        <div ref={contentRef} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="text-muted-foreground italic">{t("viewer.noContentAvailable")}</div>
      )}

      {contextMenu && onCreateFlashcard && (
        <>
          <div className="fixed inset-0 z-[9999]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="fixed z-[10000] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                onCreateFlashcard(contextMenu.selectedText);
              }}
            >
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              {t("extractScrollItem.createFlashcard")}
            </button>
          </div>
        </>
      )}
    </div>
    </>
  );
}
