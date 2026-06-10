import { useMemo } from "react";
import { 
  Rss, 
  BookOpen, 
  Star, 
  Brain, 
  Plus, 
  Keyboard, 
  RefreshCw, 
  TrendingUp, 
  Compass, 
  History,
  Link2
} from "lucide-react";
import { type Feed, type FeedItem, formatFeedDate } from "../../api/rss";

interface RSSDashboardProps {
  feeds: Feed[];
  selectedRssItemsCount: number;
  onViewModeChange: (mode: "all" | "unread" | "favorites" | "search") => void;
  onSelectArticle: (feed: Feed, item: FeedItem) => void;
  onSelectFeed: (feed: Feed) => void;
  onOpenDiscover: () => void;
  onOpenAddFeed: () => void;
  onOpenSemanticGraph: () => void;
  onOpenShortcutsHelp: () => void;
  onSyncAll: () => void;
  isSyncing: boolean;
}

export function RSSDashboard({
  feeds,
  selectedRssItemsCount,
  onViewModeChange,
  onSelectArticle,
  onSelectFeed,
  onOpenDiscover,
  onOpenAddFeed,
  onOpenSemanticGraph,
  onOpenShortcutsHelp,
  onSyncAll,
  isSyncing
}: RSSDashboardProps) {
  // Counts
  const feedsCount = feeds.length;
  const unreadCount = useMemo(() => feeds.reduce((acc, f) => acc + f.unreadCount, 0), [feeds]);
  const favoritesCount = useMemo(() => feeds.reduce((acc, f) => acc + f.items.filter(item => item.favorite).length, 0), [feeds]);
  
  // Recent 5 articles across all feeds
  const recentArticles = useMemo(() => {
    const all: Array<{ feed: Feed; item: FeedItem }> = [];
    feeds.forEach(f => {
      f.items.forEach(i => {
        all.push({ feed: f, item: i });
      });
    });
    return all
      .sort((a, b) => new Date(b.item.pubDate).getTime() - new Date(a.item.pubDate).getTime())
      .slice(0, 5);
  }, [feeds]);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-background via-background/95 to-muted/20 scrollbar-thin">
      <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8">
        
        {/* Header Section */}
        <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Rss className="w-6 h-6 text-orange-500" />
              Feed Overview
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Your personalized hub for articles, news, and newsletters.
            </p>
          </div>
          <button
            onClick={onSyncAll}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-lg border border-border/80 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-orange-500" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Feening"}</span>
          </button>
        </div>

        {/* Hero Banner Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/15 rounded-2xl p-6 shadow-sm">
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
            <Rss className="w-24 h-24 text-orange-500" />
          </div>
          <div className="max-w-xl">
            <h3 className="text-base font-bold text-foreground mb-1.5">Welcome to your RSS Dashboard</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Read articles, save highlights, and organize knowledge. Select a feed or article from the sidebar to start reading, or click any unread card below.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Subscribed Feeds */}
          <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col justify-between hover:shadow-md hover:border-blue-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Feeds</span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                <Rss className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h4 className="text-2xl font-bold text-foreground">{feedsCount}</h4>
              <span className="text-[10px] text-muted-foreground">active subscriptions</span>
            </div>
          </div>

          {/* Unread Stories */}
          <div 
            onClick={() => onViewModeChange("unread")}
            className="bg-card border border-border/60 rounded-xl p-4 flex flex-col justify-between hover:shadow-md hover:border-orange-500/30 cursor-pointer transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Unread</span>
              <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h4 className="text-2xl font-bold text-foreground">{unreadCount}</h4>
              <span className="text-[10px] text-orange-500 dark:text-orange-400 font-medium group-hover:underline">Click to view unread</span>
            </div>
          </div>

          {/* Starred Stories */}
          <div 
            onClick={() => onViewModeChange("favorites")}
            className="bg-card border border-border/60 rounded-xl p-4 flex flex-col justify-between hover:shadow-md hover:border-yellow-500/30 cursor-pointer transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Favorites</span>
              <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 group-hover:scale-110 transition-transform">
                <Star className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h4 className="text-2xl font-bold text-foreground">{favoritesCount}</h4>
              <span className="text-[10px] text-yellow-500 dark:text-yellow-400 font-medium group-hover:underline">Click to view favorites</span>
            </div>
          </div>

          {/* Semantic Batch */}
          <div 
            onClick={onOpenSemanticGraph}
            className="bg-card border border-border/60 rounded-xl p-4 flex flex-col justify-between hover:shadow-md hover:border-purple-500/30 cursor-pointer transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Semantic Study</span>
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform">
                <Brain className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h4 className="text-2xl font-bold text-foreground">{selectedRssItemsCount}</h4>
              <span className="text-[10px] text-purple-500 dark:text-purple-400 font-medium group-hover:underline">Open visual graph</span>
            </div>
          </div>
        </div>

        {/* Quick Actions & Keyboard Shortcuts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              Quick Actions
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {/* Discover Sites */}
              <button 
                onClick={onOpenDiscover}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/40 text-left transition-all duration-200 group hover:-translate-y-0.5"
              >
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-200">
                  <Compass className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-foreground block">Discover Sites</span>
                  <span className="text-[10px] text-muted-foreground block truncate">Search and subscribe to popular news sources</span>
                </div>
              </button>

              {/* Add Feed */}
              <button 
                onClick={onOpenAddFeed}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/40 text-left transition-all duration-200 group hover:-translate-y-0.5"
              >
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all duration-200">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-foreground block">Subscribe to URL</span>
                  <span className="text-[10px] text-muted-foreground block truncate">Add a custom XML feed, RSS link, or Newsletter</span>
                </div>
              </button>

              {/* Import OPML */}
              <button 
                onClick={onOpenAddFeed} // In RSSReader OPML import is inside a settings menu, but we can reuse discover/add options
                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/40 text-left transition-all duration-200 group hover:-translate-y-0.5"
              >
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all duration-200">
                  <Link2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-foreground block">OPML & Newsletters</span>
                  <span className="text-[10px] text-muted-foreground block truncate">Import newsletter subscriptions or OPML backup files</span>
                </div>
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts Cheatsheet */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Keyboard className="w-4 h-4 text-orange-500" />
              Keyboard Navigation
            </h4>
            <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground">Select next/prev article</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono font-bold shadow-sm">j</kbd>
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono font-bold shadow-sm">k</kbd>
                  <span className="text-muted-foreground text-[10px] font-medium mx-0.5">or</span>
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono font-bold shadow-sm">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono font-bold shadow-sm">↓</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground">Navigate RSS feeds</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono font-bold shadow-sm">Shift</kbd>
                  <span className="text-muted-foreground text-[10px] font-medium">+</span>
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono font-bold shadow-sm">j</kbd>
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono font-bold shadow-sm">k</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground">Star/Favorite article</span>
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono font-bold shadow-sm">s</kbd>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground">Toggle read status</span>
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono font-bold shadow-sm">m</kbd>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-border/40 pb-2.5">
                <span className="text-muted-foreground">Open original link</span>
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono font-bold shadow-sm">v</kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Show shortcuts cheat sheet</span>
                <button 
                  onClick={onOpenShortcutsHelp}
                  className="px-1.5 py-0.5 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border border-orange-500/20 rounded text-[10px] font-mono font-bold shadow-sm transition-all"
                >
                  ?
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Articles Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <History className="w-4 h-4 text-orange-500" />
            Recent Stories
          </h4>
          {recentArticles.length === 0 ? (
            <div className="text-center p-8 bg-card border border-border/60 rounded-xl text-xs text-muted-foreground shadow-sm">
              No articles loaded yet. Click sync above or select a feed to download articles.
            </div>
          ) : (
            <div className="bg-card border border-border/60 rounded-xl overflow-hidden divide-y divide-border/40 shadow-sm">
              {recentArticles.map(({ feed, item }) => (
                <div 
                  key={item.id}
                  onClick={() => onSelectArticle(feed, item)}
                  className="p-4 hover:bg-muted/30 cursor-pointer transition-colors flex justify-between gap-4 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectFeed(feed);
                        }}
                        className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider hover:underline"
                      >
                        {feed.title}
                      </button>
                      <span className="text-[10px] text-muted-foreground">•</span>
                      <span className="text-[10px] text-muted-foreground">{formatFeedDate(item.pubDate)}</span>
                    </div>
                    <h5 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-1">
                      {item.title}
                    </h5>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description ? item.description.replace(/<[^>]*>/g, "") : ""}
                    </p>
                  </div>
                  {item.thumbnail && (
                    <div className="w-16 h-12 rounded overflow-hidden flex-shrink-0 bg-muted border border-border/50">
                      <img 
                        src={item.thumbnail} 
                        alt="" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
