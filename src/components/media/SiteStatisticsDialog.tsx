/**
 * SiteStatisticsDialog
 * Display frequency, article count, category overlap for discovered sites
 */

import { useState } from "react";
import { X, BarChart3, Rss } from "lucide-react";
import { subscribeToFeedAuto, type Feed } from "../../api/rss";

interface SiteStatisticsDialogProps {
  siteUrl: string;
  siteTitle: string;
  feedUrl?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SiteStatisticsDialog({ siteUrl, siteTitle, feedUrl, isOpen, onClose }: SiteStatisticsDialogProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = async () => {
    if (!feedUrl) return;
    setIsSubscribing(true);
    try {
      const now = new Date().toISOString();
      const feed: Feed = {
        id: `feed-${Date.now()}`,
        title: siteTitle,
        feedUrl,
        link: siteUrl,
        description: "",
        items: [],
        unreadCount: 0,
        lastUpdated: now,
        lastFetched: now,
        updateInterval: 60,
        subscribeDate: now,
      };
      await subscribeToFeedAuto(feed);
      setIsSubscribed(true);
    } catch (err) {
      console.error("[SiteStats] Failed to subscribe:", err);
    }
    setIsSubscribing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Site Statistics</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <h3 className="text-sm font-medium text-foreground mb-1">{siteTitle}</h3>
          <p className="text-xs text-muted-foreground mb-4 truncate">{siteUrl}</p>

          <div className="space-y-3">
            <StatRow icon={<Rss className="w-4 h-4" />} label="Status" value={isSubscribed ? "Subscribed" : "Not subscribed"} highlight={!isSubscribed} />
            <StatRow icon={<TrendingUp className="w-4 h-4" />} label="Feed URL" value={feedUrl || "Not found"} />
          </div>

          {!isSubscribed && feedUrl && (
            <button
              onClick={() => void handleSubscribe()}
              disabled={isSubscribing}
              className="w-full mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Rss className="w-4 h-4" />
              {isSubscribing ? "Subscribing..." : "Subscribe"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className={`text-sm font-medium truncate max-w-[200px] ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
