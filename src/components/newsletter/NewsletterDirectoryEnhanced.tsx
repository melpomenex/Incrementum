/**
 * Enhanced Newsletter Directory
 * 
 * Improvements:
 * - Smart URL importer at the top
 * - Preview modals for newsletters
 * - Rich metadata display
 * - Better categorization
 * - Trending section
 * - Improved search with filters
 */

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Rss,
  ExternalLink,
  Check,
  Grid3x3,
  List,
  User,
  BookOpen,
  Heart,
  Briefcase,
  TrendingUp,
  Laptop,
  Microscope,
  GraduationCap,
  Palette,
  Coffee,
  Landmark,
  Coins,
  X,
  Sparkles,
  Link2,
  Loader2,
  Clock,
  FileText,
  ArrowUpRight,
} from "lucide-react";
import {
  newsletterDirectory,
  newsletterCategories,
  type NewsletterCategory,
  type NewsletterSource,
  getNewslettersByCategory,
  searchNewsletters,
} from "../../data/newsletterDirectory";
import { subscribeToFeedAuto, type Feed, fetchFeed } from "../../api/rss";
import { NewsletterUrlImporter } from "./NewsletterUrlImporter";

// Platform icons mapping
type PlatformType = "substack" | "beehiiv" | "ghost" | "medium" | "wordpress" | "custom";

const PLATFORM_BADGES: Record<PlatformType, { label: string; color: string; icon: string }> = {
  substack: { 
    label: "Substack", 
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200",
    icon: "📰"
  },
  beehiiv: { 
    label: "Beehiiv", 
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200",
    icon: "🐝"
  },
  ghost: { 
    label: "Ghost", 
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200",
    icon: "👻"
  },
  medium: { 
    label: "Medium", 
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200",
    icon: "📄"
  },
  wordpress: { 
    label: "WordPress", 
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200",
    icon: "📝"
  },
  custom: { 
    label: "RSS", 
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200",
    icon: "📡"
  },
};

const categoryIcons: Record<NewsletterCategory, React.ElementType> = {
  technology: Laptop,
  science: Microscope,
  finance: TrendingUp,
  business: Briefcase,
  health: Heart,
  lifestyle: Coffee,
  politics: Landmark,
  arts: Palette,
  education: GraduationCap,
  crypto: Coins,
};

type ViewMode = "grid" | "list";
type TabType = "directory" | "import" | "trending";

interface NewsletterDirectoryProps {
  onSubscribe?: (feed: Feed) => void;
  onClose?: () => void;
}

// Preview Modal Component
function NewsletterPreviewModal({ 
  newsletter, 
  onClose, 
  onSubscribe,
  isSubscribing 
}: { 
  newsletter: NewsletterSource; 
  onClose: () => void;
  onSubscribe: () => void;
  isSubscribing: boolean;
}) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        setLoading(true);
        const fetched = await fetchFeed(newsletter.feedUrl);
        setFeed(fetched);
      } catch {
        setError("Failed to load preview");
      } finally {
        setLoading(false);
      }
    };
    loadPreview();
  }, [newsletter.feedUrl]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: "short", 
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${PLATFORM_BADGES[newsletter.platform].color}`}>
                {PLATFORM_BADGES[newsletter.platform].icon}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{newsletter.title}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                  {newsletter.author}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-muted-foreground mt-4">{newsletter.description}</p>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${PLATFORM_BADGES[newsletter.platform].color}`}>
              {PLATFORM_BADGES[newsletter.platform].label}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              {newsletterCategories.find(c => c.id === newsletter.category)?.name}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading preview...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{error}</p>
            </div>
          ) : feed ? (
            <div>
              <h3 className="font-medium text-sm text-muted-foreground mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Recent Articles ({feed.items.length})
              </h3>
              <div className="space-y-3">
                {feed.items.slice(0, 5).map((item) => (
                  <a
                    key={item.id}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors group"
                  >
                    <h4 className="font-medium group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(item.pubDate)}
                      </span>
                      {item.author && (
                        <span>by {item.author}</span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {item.description.replace(/<[^>]*>/g, "").slice(0, 150)}...
                      </p>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted/20">
          <div className="flex gap-3">
            <button
              onClick={onSubscribe}
              disabled={isSubscribing}
              className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {isSubscribing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Subscribing...
                </>
              ) : (
                <>
                  <Rss className="w-4 h-4" />
                  Subscribe to Feed
                </>
              )}
            </button>
            <a
              href={newsletter.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-background border border-border font-medium rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Visit
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewsletterDirectoryEnhanced({ onSubscribe, onClose }: NewsletterDirectoryProps) {
  const [selectedCategory, setSelectedCategory] = useState<NewsletterCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeTab, setActiveTab] = useState<TabType>("directory");
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
  const [subscribing, setSubscribing] = useState<Set<string>>(new Set());
  const [previewNewsletter, setPreviewNewsletter] = useState<NewsletterSource | null>(null);

  // Filter newsletters
  const filteredNewsletters = useMemo(() => {
    if (searchQuery.trim()) {
      return searchNewsletters(searchQuery);
    }
    if (selectedCategory !== "all") {
      return getNewslettersByCategory(selectedCategory);
    }
    return newsletterDirectory;
  }, [selectedCategory, searchQuery]);

  // Handle subscribe
  const handleSubscribe = async (newsletter: NewsletterSource) => {
    if (subscribing.has(newsletter.id)) return;

    setSubscribing(prev => new Set(prev).add(newsletter.id));

    try {
      const feed: Feed = {
        id: `newsletter-${newsletter.id}`,
        title: newsletter.title,
        description: newsletter.description,
        link: newsletter.webUrl,
        feedUrl: newsletter.feedUrl,
        imageUrl: newsletter.imageUrl,
        language: undefined,
        category: newsletter.category,
        lastUpdated: new Date().toISOString(),
        lastFetched: new Date().toISOString(),
        updateInterval: 60,
        items: [],
        subscribeDate: new Date().toISOString(),
        unreadCount: 0,
      };

      await subscribeToFeedAuto(feed);
      setSubscribedIds(prev => new Set(prev).add(newsletter.id));
      onSubscribe?.(feed);
    } catch (error) {
      console.error("Failed to subscribe:", error);
      alert(`Failed to subscribe: ${(error as Error).message}`);
    } finally {
      setSubscribing(prev => {
        const next = new Set(prev);
        next.delete(newsletter.id);
        return next;
      });
    }
  };

  const isSubscribed = (id: string) => subscribedIds.has(id);
  const isLoading = (id: string) => subscribing.has(id);

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/70 bg-gradient-to-b from-muted/20 via-muted/10 to-transparent">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center border border-orange-500/30">
              <Rss className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Newsletter Directory</h1>
              <p className="text-sm text-muted-foreground">
                Discover and subscribe to newsletters from your favorite writers
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 mb-4">
          {[
            { id: "directory" as const, label: "Directory", icon: BookOpen },
            { id: "import" as const, label: "Add by URL", icon: Link2 },
            { id: "trending" as const, label: "Trending", icon: TrendingUp },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "import" && (
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Link2 className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Import Newsletter by URL</h2>
                <p className="text-muted-foreground">
                  Paste any newsletter URL and we'll automatically detect and subscribe to its RSS feed.
                  Works with Substack, Beehiiv, Ghost, and more.
                </p>
              </div>
              <NewsletterUrlImporter
                onSuccess={(feed) => {
                  onSubscribe?.(feed);
                  setActiveTab("directory");
                }}
              />
              
              {/* Supported Platforms */}
              <div className="mt-12">
                <h3 className="text-sm font-medium text-muted-foreground text-center mb-4">
                  Supported Platforms
                </h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {Object.entries(PLATFORM_BADGES).map(([key, config]) => (
                    <div 
                      key={key}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.color}`}
                    >
                      <span>{config.icon}</span>
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "trending" && (
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-6 h-6 text-yellow-500" />
                <div>
                  <h2 className="text-lg font-semibold">Trending Newsletters</h2>
                  <p className="text-sm text-muted-foreground">
                    Popular newsletters based on community subscriptions
                  </p>
                </div>
              </div>
              
              {/* Featured/Trending Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {newsletterDirectory
                  .slice(0, 6)
                  .map((newsletter) => (
                    <div
                      key={newsletter.id}
                      className="p-4 rounded-xl bg-gradient-to-br from-card to-muted/50 border border-border hover:border-primary/30 transition-all cursor-pointer"
                      onClick={() => setPreviewNewsletter(newsletter)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${PLATFORM_BADGES[newsletter.platform].color}`}>
                          {PLATFORM_BADGES[newsletter.platform].icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{newsletter.title}</h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {newsletter.author}
                          </p>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "directory" && (
          <>
            {/* Search and Filters */}
            <div className="px-6 py-4 border-b border-border/70 bg-muted/10">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search newsletters..."
                    className="w-full pl-10 pr-4 py-2.5 bg-background/80 border border-border/70 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                </div>
                <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 border border-border/50">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded transition-colors ${
                      viewMode === "grid"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                    title="Grid view"
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 rounded transition-colors ${
                      viewMode === "list"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                    title="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide mt-3">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    selectedCategory === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  All ({newsletterDirectory.length})
                </button>
                {newsletterCategories.map((category) => {
                  const Icon = categoryIcons[category.id];
                  const count = getNewslettersByCategory(category.id).length;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                        selectedCategory === category.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{category.name}</span>
                      <span className="text-xs opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Newsletter Grid/List */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredNewsletters.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No newsletters found
                  </h3>
                  <p className="text-muted-foreground max-w-md">
                    {searchQuery
                      ? `No newsletters match "${searchQuery}"`
                      : "No newsletters in this category yet."}
                  </p>
                </div>
              ) : (
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                      : "flex flex-col gap-3 max-w-4xl mx-auto"
                  }
                >
                  {filteredNewsletters.map((newsletter) => {
                    const subscribed = isSubscribed(newsletter.id);
                    const loading = isLoading(newsletter.id);
                    const platform = PLATFORM_BADGES[newsletter.platform];

                    return (
                      <div
                        key={newsletter.id}
                        onClick={() => setPreviewNewsletter(newsletter)}
                        className={`group relative bg-card rounded-xl border transition-all duration-200 overflow-hidden cursor-pointer ${
                          subscribed
                            ? "border-green-500/30 bg-green-500/5"
                            : "border-border/70 hover:border-primary/50 hover:shadow-sm"
                        }`}
                      >
                        {/* Subscribed Badge */}
                        {subscribed && (
                          <div className="absolute top-3 right-3 z-10">
                            <div className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                              <Check className="w-3 h-3" />
                              <span>Subscribed</span>
                            </div>
                          </div>
                        )}

                        <div className={`p-5 ${viewMode === "list" ? "flex items-start gap-4" : ""}`}>
                          {/* Icon */}
                          <div
                            className={`${
                              viewMode === "grid" ? "mb-3" : "flex-shrink-0"
                            } w-12 h-12 rounded-xl flex items-center justify-center text-xl ${platform.color}`}
                          >
                            {platform.icon}
                          </div>

                          {/* Info */}
                          <div className={viewMode === "grid" ? "" : "flex-1 min-w-0"}>
                            {/* Platform & Category */}
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium border ${platform.color}`}>
                                {platform.label}
                              </span>
                              <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full font-medium">
                                {newsletterCategories.find((c) => c.id === newsletter.category)?.name}
                              </span>
                            </div>

                            <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                              {newsletter.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                              <User className="w-3.5 h-3.5" />
                              {newsletter.author}
                            </p>
                            <p className={`text-sm text-muted-foreground mb-4 ${
                              viewMode === "list" ? "line-clamp-2" : "line-clamp-3"
                            }`}>
                              {newsletter.description}
                            </p>

                            {/* Actions */}
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              {subscribed ? (
                                <button
                                  disabled
                                  className="flex-1 px-4 py-2 bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium rounded-lg cursor-default flex items-center justify-center gap-2"
                                >
                                  <Check className="w-4 h-4" />
                                  Subscribed
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSubscribe(newsletter)}
                                  disabled={loading}
                                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                >
                                  {loading ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Adding...
                                    </>
                                  ) : (
                                    <>
                                      <Rss className="w-4 h-4" />
                                      Subscribe
                                    </>
                                  )}
                                </button>
                              )}
                              <a
                                href={newsletter.webUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-3 py-2 bg-muted/60 text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted hover:text-foreground transition-all"
                                title="Visit website"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Preview Modal */}
      {previewNewsletter && (
        <NewsletterPreviewModal
          newsletter={previewNewsletter}
          onClose={() => setPreviewNewsletter(null)}
          onSubscribe={() => handleSubscribe(previewNewsletter)}
          isSubscribing={subscribing.has(previewNewsletter.id)}
        />
      )}
    </div>
  );
}

export default NewsletterDirectoryEnhanced;
