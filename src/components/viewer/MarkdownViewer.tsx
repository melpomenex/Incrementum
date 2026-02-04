import { Document } from "../../types";
import { renderMarkdown } from "../../utils/markdown";

interface DocumentViewerProps {
  document: Document;
  content?: string;
}

export function MarkdownViewer({ document, content }: DocumentViewerProps) {
  const html = content ? renderMarkdown(content) : "";

  return (
    <div className="markdown-viewer prose prose-sm max-w-none dark:prose-invert reading-prose">
      <h1 className="reading-title">{document.title}</h1>
      {content ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="text-muted-foreground italic">No content available</div>
      )}
    </div>
  );
}
