/**
 * RichContentRenderer - Safely renders rich HTML content with theme-aware styling
 *
 * Uses sandboxed iframe for HTML content to:
 * - Apply the user's active theme colors and fonts
 * - Preserve structural layout (flex, grid, spacing)
 * - Prevent XSS attacks via sandbox restrictions
 * - Isolate content from the parent document
 */

import { useRef, useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";

interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  muted: string;
  mutedForeground: string;
  border: string;
}

interface RichContentRendererProps {
  /** Plain text content (required for fallback and accessibility) */
  content: string;
  /** Rich HTML content with inline styles for visual fidelity */
  htmlContent?: string;
  /** Source URL of the content (for attribution) */
  sourceUrl?: string;
  /** Whether to show the full HTML or just text preview */
  mode?: "full" | "preview" | "text-only";
  /** Maximum height for the content container */
  maxHeight?: string;
  /** Custom className for the container */
  className?: string;
  /** Whether the content is expanded */
  expanded?: boolean;
}

/**
 * Sanitizes HTML content by removing potentially dangerous elements
 * while preserving styling for visual fidelity
 */
export function sanitizeHtml(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;

  const scripts = container.querySelectorAll("script");
  scripts.forEach((script) => script.remove());

  const allElements = container.querySelectorAll("*");
  allElements.forEach((element) => {
    Array.from(element.attributes).forEach((attr) => {
      if (attr.name.startsWith("on")) {
        element.removeAttribute(attr.name);
      }
    });

    if (element instanceof HTMLAnchorElement && element.href?.startsWith("javascript:")) {
      element.removeAttribute("href");
    }
    if (element instanceof HTMLElement && element.style.backgroundImage?.includes("javascript:")) {
      element.style.backgroundImage = "";
    }
  });

  const iframes = container.querySelectorAll("iframe");
  iframes.forEach((iframe) => iframe.remove());

  const embeds = container.querySelectorAll("object, embed, applet");
  embeds.forEach((embed) => embed.remove());

  const forms = container.querySelectorAll("form");
  forms.forEach((form) => form.remove());

  const bases = container.querySelectorAll("base");
  bases.forEach((base) => base.remove());

  return container.innerHTML;
}

function readThemeColors(): ThemeColors {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  return {
    background: cs.getPropertyValue("--color-background").trim() || "#ffffff",
    foreground: cs.getPropertyValue("--color-foreground").trim() || "#1a1a1a",
    primary: cs.getPropertyValue("--color-primary").trim() || "#0066cc",
    muted: cs.getPropertyValue("--color-muted").trim() || "#f5f5f5",
    mutedForeground: cs.getPropertyValue("--color-muted-foreground").trim() || "#555555",
    border: cs.getPropertyValue("--color-border").trim() || "#dddddd",
  };
}

/**
 * Creates an HTML document for the iframe with theme-aware styling
 */
function createIframeDocument(htmlContent: string, theme: ThemeColors): string {
  const sanitized = sanitizeHtml(htmlContent);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: ${theme.foreground};
      background: transparent;
    }
    body {
      padding: 8px;
    }
    /* Strip cosmetic inline styles so theme tokens cascade */
    body * {
      color: inherit !important;
      background-color: transparent !important;
      font-family: inherit !important;
      font-size: inherit !important;
    }
    /* Ensure images are responsive */
    img {
      max-width: 100% !important;
      height: auto !important;
      border-radius: 6px !important;
    }
    /* Make links use theme primary color */
    a {
      color: ${theme.primary} !important;
      text-decoration: underline !important;
      cursor: pointer;
    }
    /* Preserve code styling */
    pre, code {
      font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
      background-color: ${theme.muted} !important;
      border-radius: 4px;
    }
    pre {
      padding: 12px;
      overflow-x: auto;
    }
    code {
      padding: 2px 4px;
    }
    /* Table styling */
    table {
      border-collapse: collapse;
      width: 100%;
    }
    th, td {
      border: 1px solid ${theme.border};
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: ${theme.muted} !important;
      font-weight: 600 !important;
    }
    /* List styling */
    ul, ol {
      padding-left: 24px;
    }
    /* Blockquote styling */
    blockquote {
      border-left: 4px solid ${theme.primary};
      margin-left: 0;
      padding-left: 16px;
      color: ${theme.mutedForeground} !important;
    }
  </style>
</head>
<body>
  ${sanitized}
</body>
</html>
`;
}

export function RichContentRenderer({
  content,
  htmlContent,
  sourceUrl,
  mode = "full",
  maxHeight = "400px",
  className = "",
  expanded = true,
}: RichContentRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(100);
  const [isLoading, setIsLoading] = useState(true);

  if (!htmlContent || mode === "text-only") {
    return (
      <div className={`text-sm text-foreground leading-relaxed ${className}`}>
        {mode === "preview" ? (
          <p className="line-clamp-3">{content}</p>
        ) : (
          <p className="whitespace-pre-wrap">{content}</p>
        )}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
          >
            <ExternalLink className="w-3 h-3" />
            View source
          </a>
        )}
      </div>
    );
  }

  if (mode === "preview") {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <FileText className="w-3 h-3" />
          <span>Rich content available</span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{content}</p>
      </div>
    );
  }

  const handleIframeLoad = () => {
    setIsLoading(false);
    if (iframeRef.current?.contentWindow?.document?.body) {
      const body = iframeRef.current.contentWindow.document.body;
      const height = body.scrollHeight;
      setIframeHeight(Math.min(height, parseInt(maxHeight)));
    }
  };

  useEffect(() => {
    if (iframeRef.current && expanded) {
      const theme = readThemeColors();
      const doc = createIframeDocument(htmlContent, theme);
      const blob = new Blob([doc], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      iframeRef.current.src = url;

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [htmlContent, expanded]);

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Rich content"
        className="w-full border-0 rounded-lg"
        style={{ height: `${iframeHeight}px`, maxHeight, background: "transparent" }}
        sandbox="allow-same-origin"
        onLoad={handleIframeLoad}
      />
      {sourceUrl && (
        <div className="mt-2 pt-2 border-t border-border/30">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            View original source
          </a>
        </div>
      )}
    </div>
  );
}

export default RichContentRenderer;
