/**
 * DisabledFeedsView
 * List disabled feeds with enable action
 */

import { useState, useEffect } from "react";
import { Power, Loader2 } from "lucide-react";
import { toggleFeedActiveAuto } from "../../api/rss-folders";
import type { Feed } from "../../api/rss";

interface DisabledFeedsViewProps {
  feeds: Feed[];
  onFeedToggled?: (feedId: string, isActive: boolean) => void;
  onBack?: () => void;
}

export function DisabledFeedsView({ feeds, onFeedToggled, onBack }: DisabledFeedsViewProps) {
  const disabledFeeds = feeds.filter((f) => (f as any).isActive === false);
  const [toggling, setToggling] = useState<string | null>(null);

  const handleEnable = async (feedId: string) => {
    setToggling(feedId);
    try {
      const isActive = await toggleFeedActiveAuto(feedId);
      onFeedToggled?.(feedId, isActive);
    } catch (err) {
      console.error("[DisabledFeeds] Failed to enable:", err);
    }
    setToggling(null);
  };

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Power className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Disabled Feeds</h2>
          <span className="text-xs text-muted-foreground">({disabledFeeds.length})</span>
        </div>
        {onBack && (
          <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground rounded">
            ×
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {disabledFeeds.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Power className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No disabled feeds</p>
          </div>
        ) : (
          disabledFeeds.map((feed) => (
            <div
              key={feed.id}
              className="flex items-center justify-between p-3 border border-border/50 rounded-lg"
            >
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium text-foreground truncate">{feed.title}</h4>
                <p className="text-xs text-muted-foreground truncate">{feed.feedUrl}</p>
              </div>
              <button
                onClick={() => void handleEnable(feed.id)}
                disabled={toggling === feed.id}
                className="px-3 py-1.5 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 disabled:opacity-50 flex items-center gap-1"
              >
                {toggling === feed.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Power className="w-3 h-3" />
                )}
                Enable
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
