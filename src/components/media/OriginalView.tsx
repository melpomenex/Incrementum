/**
 * OriginalView
 * iframe embed of source URL with CSP fallback to "Open in browser"
 */

import { useState } from "react";
import { ExternalLink, ShieldAlert, Loader2 } from "lucide-react";
import { openExternal } from "../../lib/tauri";
import type { FeedItem } from "../../api/rss";

interface OriginalViewProps {
  item: FeedItem;
}

export function OriginalView({ item }: OriginalViewProps) {
  const [iframeError, setIframeError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleIframeLoad = () => setIsLoading(false);
  const handleIframeError = () => {
    setIframeError(true);
    setIsLoading(false);
  };

  const openInBrowser = () => {
    if (typeof window !== "undefined" && window.open) {
      window.open(item.link, "_blank", "noopener,noreferrer");
    } else {
      void openExternal(item.link);
    }
  };

  if (!item.link) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No URL available
      </div>
    );
  }

  if (iframeError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <ShieldAlert className="w-12 h-12 text-muted-foreground" />
        <div>
          <p className="text-foreground font-medium mb-1">Cannot embed this page</p>
          <p className="text-sm text-muted-foreground">
            This site blocks embedding. Open it in your browser instead.
          </p>
        </div>
        <button
          onClick={openInBrowser}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Open in Browser
        </button>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <iframe
        src={item.link}
        className="w-full h-full border-0"
        sandbox="allow-same-origin allow-scripts allow-popups"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title={item.title}
      />
    </div>
  );
}
