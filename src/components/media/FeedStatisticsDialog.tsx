/**
 * FeedStatisticsDialog
 * Display article count, frequency, last fetch, subscribed date, unread count
 */

import { useEffect, useState } from "react";
import { X, BarChart3, Rss, Clock, Calendar, FileText } from "lucide-react";
import { getFeedStatisticsAuto, type RssFeedStatistics } from "../../api/rss-folders";
import type { Feed } from "../../api/rss";

interface FeedStatisticsDialogProps {
  feed: Feed | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FeedStatisticsDialog({ feed, isOpen, onClose }: FeedStatisticsDialogProps) {
  const [stats, setStats] = useState<RssFeedStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && feed) {
      setIsLoading(true);
      getFeedStatisticsAuto(feed.id)
        .then(setStats)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, feed]);

  if (!isOpen || !feed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Feed Statistics</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <h3 className="text-sm font-medium text-foreground mb-1">{feed.title}</h3>
          <p className="text-xs text-muted-foreground mb-4 truncate">{feed.feedUrl}</p>

          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
          ) : stats ? (
            <div className="space-y-3">
              <StatRow icon={<FileText className="w-4 h-4" />} label="Total Articles" value={String(stats.total_articles)} />
              <StatRow icon={<Rss className="w-4 h-4" />} label="Unread" value={String(stats.unread_count)} highlight />
              <StatRow icon={<BarChart3 className="w-4 h-4" />} label="Frequency" value={stats.estimated_frequency} />
              <StatRow
                icon={<BarChart3 className="w-4 h-4" />}
                label="Articles/Week"
                value={stats.articles_per_week.toFixed(1)}
              />
              <StatRow
                icon={<Clock className="w-4 h-4" />}
                label="Last Fetched"
                value={stats.last_fetched ? new Date(stats.last_fetched).toLocaleDateString() : "Never"}
              />
              <StatRow
                icon={<Calendar className="w-4 h-4" />}
                label="Subscribed"
                value={new Date(stats.date_added).toLocaleDateString()}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No statistics available</p>
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
      <span className={`text-sm font-medium ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
