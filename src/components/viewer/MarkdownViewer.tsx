import { useMemo, useRef, useEffect, useCallback } from "react";
import { Document } from "../../types";
import { renderMarkdown } from "../../utils/markdown";

interface MarkdownViewerProps {
  document: Document;
  content?: string;
  /** Initial scroll percent to restore (0-100) */
  initialScrollPercent?: number;
  /** Callback when scroll position changes */
  onScrollPositionChange?: (scrollPercent: number) => void;
}

export function MarkdownViewer({
  document,
  content,
  initialScrollPercent,
  onScrollPositionChange,
}: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);
  const hasRestoredRef = useRef(false);

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

  return (
    <div
      ref={containerRef}
      data-document-scroll-container
      className="markdown-viewer prose prose-sm max-w-none dark:prose-invert reading-prose overflow-y-auto overflow-x-hidden h-full"
      onScroll={handleScroll}
    >
      <h1 className="reading-title">{document.title}</h1>
      {content ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="text-muted-foreground italic">No content available</div>
      )}
    </div>
  );
}
