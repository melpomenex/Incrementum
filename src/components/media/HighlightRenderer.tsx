/**
 * HighlightRenderer
 * Applies highlight colors to text ranges in the reader panel
 */

import type { RssAnnotation } from "../../api/rss-annotations";
import { sanitizeHtml } from "../common/RichContentRenderer";

interface HighlightRendererProps {
  content: string;
  annotations: RssAnnotation[];
  onAnnotationClick?: (annotation: RssAnnotation) => void;
}

export function HighlightRenderer({ content, annotations, onAnnotationClick }: HighlightRendererProps) {
  if (!annotations.length) {
    return (
      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
    );
  }

  const highlights = annotations
    .filter((a) => a.annotation_type === "highlight" && a.start_offset != null && a.end_offset != null)
    .sort((a, b) => (a.start_offset ?? 0) - (b.start_offset ?? 0));

  if (!highlights.length) {
    return (
      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
    );
  }

  const plainText = content.replace(/<[^>]+>/g, "");
  const segments: Array<{ text: string; annotation?: RssAnnotation }> = [];
  let lastEnd = 0;

  for (const highlight of highlights) {
    const start = highlight.start_offset ?? 0;
    const end = highlight.end_offset ?? start;
    if (start > lastEnd) {
      segments.push({ text: plainText.slice(lastEnd, start) });
    }
    if (end > start) {
      segments.push({
        text: plainText.slice(start, end),
        annotation: highlight,
      });
    }
    lastEnd = Math.max(lastEnd, end);
  }

  if (lastEnd < plainText.length) {
    segments.push({ text: plainText.slice(lastEnd) });
  }

  return (
    <div className="whitespace-pre-wrap">
      {segments.map((seg, i) =>
        seg.annotation ? (
          <span
            key={i}
            className="cursor-pointer rounded-sm px-0.5"
            role="button"
            tabIndex={0}
            style={{ backgroundColor: seg.annotation.color || "#FFE082" }}
            onClick={() => onAnnotationClick?.(seg.annotation!)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAnnotationClick?.(seg.annotation!); }}
            title={seg.annotation.content}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </div>
  );
}
