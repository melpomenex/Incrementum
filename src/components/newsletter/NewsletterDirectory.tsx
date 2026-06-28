import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  ArrowsClockwise,
  ArrowSquareOut,
  Bank,
  Briefcase,
  Check,
  CircleNotch,
  Coffee,
  Coins,
  Globe,
  GraduationCap,
  GridNine,
  Heart,
  Laptop,
  List,
  MagnifyingGlass,
  Microscope,
  Palette,
  Rss,
  Star,
  TrendUp,
  User,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  newsletterDirectory,
  newsletterCategories,
  type NewsletterCategory,
  type NewsletterSource,
  getNewslettersByCategory,
  searchNewsletters,
} from "../../data/newsletterDirectory";
import {
  subscribeToFeedAuto,
  getSubscribedFeedsAuto,
  type Feed,
  fetchFeed as fetchRssFeed,
} from "../../api/rss";
import {
  searchSubstack,
  getSubstackCategories,
  getSubstackCategoryFeed,
  deriveSubstackFeedUrl,
  deriveFeedUrlFromSubdomain,
  type SubstackSearchItem,
  type SubstackCategory,
  type SubstackPublication,
  type SubstackFeedItem,
  SubstackApiError,
} from "../../api/substack";
import { NewsletterPreviewModal } from "./NewsletterPreviewModal";

type ViewMode = "grid" | "list";

interface NewsletterDirectoryProps {
  onSubscribe?: (feed: Feed) => void;
  onClose?: () => void;
}

const categoryIcons: Record<NewsletterCategory, React.ElementType> = {
  technology: Laptop,
  science: Microscope,
  finance: TrendUp,
  business: Briefcase,
  health: Heart,
  lifestyle: Coffee,
  politics: Bank,
  arts: Palette,
  education: GraduationCap,
  crypto: Coins,
};

/** Derive a SubstackPublication from a search item (post or profile type). */
function extractPublicationFromSearch(
  item: SubstackSearchItem,
): SubstackPublication | null {
  if (item.publication) return item.publication;

  if (item.type === "profileSearchResults" && item.profiles?.length) {
    const p = item.profiles[0];
    return {
      id: p.id,
      name: p.name,
      subdomain: p.handle,
      base_url: null,
      custom_domain: null,
      author_name: p.name,
      author_handle: p.handle,
      author_bio: p.bio,
      author_photo_url: p.photo_url,
      logo_url: p.photo_url,
      hero_image: null,
      description: p.bio,
      free_subscriber_count: null,
      podcast_enabled: null,
      community_enabled: null,
    };
  }

  return null;
}

export function NewsletterDirectory({ onSubscribe, onClose }: NewsletterDirectoryProps) {
  const [selectedCategory, setSelectedCategory] = useState<NewsletterCategory | "all" | number>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [subscribedFeedUrls, setSubscribedFeedUrls] = useState<Set<string>>(new Set());
  const [subscribing, setSubscribing] = useState<Set<string>>(new Set());
  const [previewPublication, setPreviewPublication] = useState<SubstackPublication | null>(null);

  // Substack API state
  const [substackCategories, setSubstackCategories] = useState<SubstackCategory[]>([]);
  const [searchResults, setSearchResults] = useState<SubstackSearchItem[]>([]);
  const [categoryResults, setCategoryResults] = useState<SubstackFeedItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNextCursor, setSearchNextCursor] = useState<string | null>(null);
  const [categoryNextCursor, setCategoryNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const feeds = await getSubscribedFeedsAuto();
        setSubscribedFeedUrls(new Set(feeds.map((f) => f.feedUrl)));
      } catch {
        // Non-critical — subscribed badges just won't show
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cats = await getSubstackCategories();
        setSubstackCategories(cats.filter((c) => c.active));
      } catch {
        // Non-critical
      }
    })();
  }, []);

  const isSubscribed = useCallback(
    (feedUrl: string) => subscribedFeedUrls.has(feedUrl),
    [subscribedFeedUrls],
  );

  // Filtered curated newsletters
  const filteredCurated = useMemo(() => {
    if (searchQuery.trim()) return searchNewsletters(searchQuery);
    if (selectedCategory !== "all" && typeof selectedCategory === "string")
      return getNewslettersByCategory(selectedCategory);
    return newsletterDirectory;
  }, [selectedCategory, searchQuery]);

  // Determine active data source
  const hasSearchResults = searchResults.length > 0;
  const hasCategoryResults = categoryResults.length > 0;
  const isSearching = searchQuery.trim().length > 0;
  const isBrowsingCategory = typeof selectedCategory === "number";

  // Debounced search
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!query.trim()) {
        setSearchResults([]);
        setSearchNextCursor(null);
        setSearchError(null);
        return;
      }

      setSearchLoading(true);
      setSearchError(null);
      setSearchResults([]);
      setSearchNextCursor(null);

      debounceRef.current = setTimeout(async () => {
        try {
          const resp = await searchSubstack(query.trim());
          setSearchResults(resp.items);
          setSearchNextCursor(resp.nextCursor);
        } catch (err) {
          if (err instanceof SubstackApiError) {
            setSearchError(err.message);
          } else {
            setSearchError("Search failed. Please try again.");
          }
        } finally {
          setSearchLoading(false);
        }
      }, 500);
    },
    [],
  );

  const handleLoadMoreSearch = async () => {
    if (!searchNextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const resp = await searchSubstack(searchQuery.trim(), searchNextCursor);
      setSearchResults((prev) => [...prev, ...resp.items]);
      setSearchNextCursor(resp.nextCursor);
    } catch {
      // Silent fail for pagination
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (typeof selectedCategory !== "number") {
      setCategoryResults([]);
      setCategoryNextCursor(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setCategoryLoading(true);
      try {
        const resp = await getSubstackCategoryFeed(String(selectedCategory));
        if (!cancelled) {
          setCategoryResults(resp.items);
          setCategoryNextCursor(resp.nextCursor);
        }
      } catch {
      } finally {
        if (!cancelled) setCategoryLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedCategory]);

  const handleLoadMoreCategory = async () => {
    if (!categoryNextCursor || loadingMore || typeof selectedCategory !== "number") return;
    setLoadingMore(true);
    try {
      const resp = await getSubstackCategoryFeed(String(selectedCategory), categoryNextCursor);
      setCategoryResults((prev) => [...prev, ...resp.items]);
      setCategoryNextCursor(resp.nextCursor);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  };

  // Subscribe to a Substack publication from search/category results
  const handleSubstackSubscribe = async (publication: SubstackPublication) => {
    const feedUrl = publication.custom_domain
      ? `https://${publication.custom_domain}/feed`
      : deriveFeedUrlFromSubdomain(publication.subdomain);

    const key = `substack-${publication.id}`;
    if (subscribing.has(key) || isSubscribed(feedUrl)) return;

    setSubscribing((prev) => new Set(prev).add(key));

    try {
      // Fetch the RSS feed first so articles are available immediately
      let items: Feed["items"] = [];
      try {
        const fetched = await fetchRssFeed(feedUrl);
        if (fetched) items = fetched.items;
      } catch {
        // Feed fetch failed — still subscribe, articles will come on next cycle
      }

      const feed: Feed = {
        id: `substack-${publication.id}`,
        title: publication.name,
        description: publication.description ?? "",
        link: publication.base_url
          ? `https://${publication.base_url}`
          : `https://${publication.subdomain}.substack.com`,
        feedUrl,
        imageUrl: publication.logo_url ?? undefined,
        category: undefined,
        lastUpdated: new Date().toISOString(),
        lastFetched: new Date().toISOString(),
        updateInterval: 60,
        items,
        subscribeDate: new Date().toISOString(),
        unreadCount: 0,
      };

      await subscribeToFeedAuto(feed);
      setSubscribedFeedUrls((prev) => new Set(prev).add(feedUrl));
      onSubscribe?.(feed);
    } catch (error) {
      console.error("Failed to subscribe:", error);
      alert(`Failed to subscribe to ${publication.name}: ${(error as Error).message}`);
    } finally {
      setSubscribing((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Subscribe to curated newsletter
  const handleCuratedSubscribe = async (newsletter: NewsletterSource) => {
    if (subscribing.has(newsletter.id) || isSubscribed(newsletter.feedUrl)) return;

    setSubscribing((prev) => new Set(prev).add(newsletter.id));

    try {
      // Fetch the RSS feed first so articles are available immediately
      let items: Feed["items"] = [];
      try {
        const fetched = await fetchRssFeed(newsletter.feedUrl);
        if (fetched) items = fetched.items;
      } catch {
        // Feed fetch failed — still subscribe, articles will come on next cycle
      }

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
        items,
        subscribeDate: new Date().toISOString(),
        unreadCount: 0,
      };

      await subscribeToFeedAuto(feed);
      setSubscribedFeedUrls((prev) => new Set(prev).add(newsletter.feedUrl));
      onSubscribe?.(feed);
    } catch (error) {
      console.error("Failed to subscribe:", error);
      alert(`Failed to subscribe to ${newsletter.title}: ${(error as Error).message}`);
    } finally {
      setSubscribing((prev) => {
        const next = new Set(prev);
        next.delete(newsletter.id);
        return next;
      });
    }
  };

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
              <h1 className="text-2xl font-bold text-foreground">
                Newsletter Directory
              </h1>
              <p className="text-sm text-muted-foreground">
                Discover and subscribe to popular newsletters
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search Substack for newsletters, authors, topics..."
              className="w-full pl-10 pr-10 py-2.5 bg-background/80 border border-border/70 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
            {searchLoading && (
              <CircleNotch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
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
              <GridNine className="w-4 h-4" />
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
      </div>

      {/* Category Filter */}
      <div className="px-6 py-3 border-b border-border/70 bg-muted/20 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-1.5">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 ${
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            All
          </button>

          {/* Curated categories */}
          {newsletterCategories.map((category) => {
            const Icon = categoryIcons[category.id];
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 ${
                  selectedCategory === category.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{category.name}</span>
              </button>
            );
          })}

          {/* Substack categories */}
          {substackCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 ${
                selectedCategory === cat.id
                  ? "bg-orange-500 text-white shadow-md"
                  : "bg-muted/60 text-muted-foreground hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400"
              }`}
            >
              {cat.emoji && <span className="text-sm leading-none">{cat.emoji}</span>}
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Substack category browse results */}
        {isBrowsingCategory && !isSearching && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold">
                {substackCategories.find((c) => c.id === selectedCategory)?.emoji}{" "}
                {substackCategories.find((c) => c.id === selectedCategory)?.name ?? "Browse"}
              </h2>
            </div>

            {categoryLoading ? (
              <div className="flex items-center justify-center py-12">
                <CircleNotch className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading...</span>
              </div>
            ) : hasCategoryResults ? (
              <>
                <SubstackFeedGrid
                  items={categoryResults}
                  viewMode={viewMode}
                  subscribedFeedUrls={subscribedFeedUrls}
                  subscribing={subscribing}
                  onSubscribe={handleSubstackSubscribe}
                  onPreview={setPreviewPublication}
                />
                {categoryNextCursor && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={handleLoadMoreCategory}
                      disabled={loadingMore}
                      className="px-6 py-2.5 bg-muted/60 text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted hover:text-foreground transition-all disabled:opacity-50"
                    >
                      {loadingMore ? "Loading..." : "Load more"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No publications found in this category.</p>
              </div>
            )}
          </>
        )}

        {/* Search results (priority over category) */}
        {isSearching && (
          <>
            {/* Editor's Picks collapsible */}
            {!isBrowsingCategory && filteredCurated.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Editor&apos;s Picks
                  </h3>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {filteredCurated.slice(0, 6).map((newsletter) => {
                    const sub = isSubscribed(newsletter.feedUrl);
                    return (
                      <div
                        key={newsletter.id}
                        className="flex-shrink-0 w-64 p-4 rounded-xl bg-card/60 border border-border/70 hover:border-orange-500/50 transition-all cursor-pointer"
                        onClick={() => {
                          // Convert to SubstackPublication for preview
                          setPreviewPublication({
                            id: 0,
                            name: newsletter.title,
                            subdomain: newsletter.webUrl
                              .replace(/^https?:\/\//, "")
                              .split("/")[0],
                            base_url: newsletter.webUrl
                              .replace(/^https?:\/\//, "")
                              .split("/")[0],
                            custom_domain: null,
                            author_name: newsletter.author,
                            author_handle: null,
                            author_bio: null,
                            author_photo_url: newsletter.imageUrl ?? null,
                            logo_url: newsletter.imageUrl ?? null,
                            hero_image: null,
                            description: newsletter.description,
                            free_subscriber_count: null,
                            podcast_enabled: null,
                            community_enabled: null,
                          });
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {sub && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 text-xs rounded-full">
                              <Check className="w-3 h-3" /> Subscribed
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {newsletter.platform}
                          </span>
                        </div>
                        <h4 className="font-medium text-sm truncate">
                          {newsletter.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {newsletter.author}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search error */}
            {searchError && (
              <div className="text-center py-8">
                <WarningCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
                <p className="text-muted-foreground mb-3">{searchError}</p>
                <button
                  onClick={() => handleSearchChange(searchQuery)}
                  className="px-4 py-2 bg-muted text-sm rounded-lg hover:bg-muted/80 flex items-center gap-2 mx-auto"
                >
                  <ArrowsClockwise className="w-4 h-4" />
                  Retry
                </button>
              </div>
            )}

            {/* Search results heading */}
            {!searchError && hasSearchResults && (
              <div className="flex items-center gap-2 mb-4">
                <MagnifyingGlass className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">
                  Search Results
                </h2>
                <span className="text-sm text-muted-foreground">
                  ({searchResults.length} found)
                </span>
              </div>
            )}

            {/* Search results grid */}
            {!searchError && hasSearchResults && (
              <>
                <SubstackSearchGrid
                  items={searchResults}
                  viewMode={viewMode}
                  subscribedFeedUrls={subscribedFeedUrls}
                  subscribing={subscribing}
                  onSubscribe={handleSubstackSubscribe}
                  onPreview={setPreviewPublication}
                />
                {searchNextCursor && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={handleLoadMoreSearch}
                      disabled={loadingMore}
                      className="px-6 py-2.5 bg-muted/60 text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted hover:text-foreground transition-all disabled:opacity-50"
                    >
                      {loadingMore ? "Loading..." : "Load more results"}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Empty search state */}
            {!searchError && !searchLoading && !hasSearchResults && isSearching && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                  <MagnifyingGlass className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No results for &ldquo;{searchQuery}&rdquo;
                </h3>
                <p className="text-muted-foreground max-w-md">
                  Try different keywords or browse categories below.
                </p>
              </div>
            )}
          </>
        )}

        {/* Default view: Editor's Picks + Curated Directory */}
        {!isSearching && !isBrowsingCategory && (
          <>
            {/* Editor's Picks heading */}
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-semibold">Editor&apos;s Picks</h2>
              <span className="text-sm text-muted-foreground">
                ({filteredCurated.length})
              </span>
            </div>

            {filteredCurated.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                  <MagnifyingGlass className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No newsletters found
                </h3>
                <p className="text-muted-foreground max-w-md">
                  {selectedCategory !== "all"
                    ? `No newsletters in the ${
                        newsletterCategories.find((c) => c.id === selectedCategory)
                          ?.name
                      } category yet.`
                    : "The newsletter directory is empty."}
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
                {filteredCurated.map((newsletter) => {
                  const Icon = categoryIcons[newsletter.category];
                  const sub = isSubscribed(newsletter.feedUrl);
                  const loading = subscribing.has(newsletter.id);

                  return (
                    <div
                      key={newsletter.id}
                      className={`group relative bg-card/60 backdrop-blur-sm rounded-xl border ${
                        sub
                          ? "border-green-500/30 bg-green-500/5"
                          : "border-border/70 hover:border-orange-500/50 hover:bg-card/80"
                      } transition-all duration-200 overflow-hidden`}
                    >
                      {sub && (
                        <div className="absolute top-3 right-3 z-10">
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full shadow-sm">
                            <Check className="w-3 h-3" />
                            <span>Subscribed</span>
                          </div>
                        </div>
                      )}

                      <div
                        className={`p-5 ${viewMode === "list" ? "flex items-start gap-4" : ""}`}
                      >
                        <div
                          className={`${
                            viewMode === "grid" ? "mb-3" : "flex-shrink-0 mt-1"
                          } w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center border border-orange-500/30`}
                        >
                          <Icon className="w-5 h-5 text-orange-500" />
                        </div>

                        <div className={viewMode === "grid" ? "" : "flex-1 min-w-0"}>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="px-2 py-0.5 bg-muted/60 text-muted-foreground text-xs rounded-full font-medium border border-border/50">
                              {newsletter.platform}
                            </span>
                            <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs rounded-full font-medium border border-orange-500/20">
                              {newsletterCategories.find((c) => c.id === newsletter.category)?.name}
                            </span>
                          </div>

                          <h3 className="font-semibold text-foreground mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                            {newsletter.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {newsletter.author}
                          </p>
                          <p
                            className={`text-sm text-muted-foreground mb-4 ${
                              viewMode === "list" ? "line-clamp-2" : "line-clamp-3"
                            }`}
                          >
                            {newsletter.description}
                          </p>

                          <div className="flex items-center gap-2">
                            {sub ? (
                              <button
                                disabled
                                className="flex-1 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg shadow-sm cursor-default"
                              >
                                <Check className="w-4 h-4 inline mr-1" />
                                Subscribed
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCuratedSubscribe(newsletter);
                                }}
                                disabled={loading}
                                className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                              >
                                {loading ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                              className="px-4 py-2 bg-muted/60 text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted hover:text-foreground transition-all flex items-center gap-2"
                              title="Visit website"
                            >
                              <ArrowSquareOut className="w-4 h-4" />
                              <span className="hidden sm:inline">Visit</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Preview Modal */}
      {previewPublication && (
        <NewsletterPreviewModal
          publication={previewPublication}
          onClose={() => setPreviewPublication(null)}
          onSubscribe={(feed) => {
            onSubscribe?.(feed);
            setSubscribedFeedUrls((prev) => new Set(prev).add(feed.feedUrl));
          }}
          initiallySubscribed={isSubscribed(
            deriveSubstackFeedUrl(previewPublication),
          )}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

/** Grid of search result items (post/profile type). */
function SubstackSearchGrid({
  items,
  viewMode,
  subscribedFeedUrls,
  subscribing,
  onSubscribe,
  onPreview,
}: {
  items: SubstackSearchItem[];
  viewMode: ViewMode;
  subscribedFeedUrls: Set<string>;
  subscribing: Set<string>;
  onSubscribe: (pub: SubstackPublication) => void;
  onPreview: (pub: SubstackPublication) => void;
}) {
  return (
    <div
      className={
        viewMode === "grid"
          ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          : "flex flex-col gap-3 max-w-4xl mx-auto"
      }
    >
      {items.map((item, idx) => {
        const pub = extractPublicationFromSearch(item);
        if (!pub) return null;

        const feedUrl = pub.custom_domain
          ? `https://${pub.custom_domain}/feed`
          : `https://${pub.subdomain}.substack.com/feed`;
        const sub = subscribedFeedUrls.has(feedUrl);
        const loading = subscribing.has(`substack-${pub.id}`);
        const postTitle = item.post?.title;

        return (
          <div
            key={`${item.type}-${idx}`}
            onClick={() => onPreview(pub)}
            className="group relative bg-card/60 backdrop-blur-sm rounded-xl border border-border/70 hover:border-orange-500/50 hover:bg-card/80 transition-all duration-200 overflow-hidden cursor-pointer"
          >
            {sub && (
              <div className="absolute top-3 right-3 z-10">
                <div className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full shadow-sm">
                  <Check className="w-3 h-3" />
                  <span>Subscribed</span>
                </div>
              </div>
            )}

            <div className={`p-5 ${viewMode === "list" ? "flex items-start gap-4" : ""}`}>
              <div
                className={`${
                  viewMode === "grid" ? "mb-3" : "flex-shrink-0 mt-1"
                } w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center border border-orange-200 dark:border-orange-800 overflow-hidden flex-shrink-0`}
              >
                {pub.logo_url ? (
                  <img
                    src={pub.logo_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Rss className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                )}
              </div>

              <div className={viewMode === "grid" ? "" : "flex-1 min-w-0"}>
                <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs rounded-full font-medium border border-orange-500/20">
                  Substack
                </span>

                <h3 className="font-semibold text-foreground mt-2 mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {pub.name}
                </h3>

                {item.type === "post" && postTitle && (
                  <p className="text-xs text-muted-foreground italic line-clamp-1 mb-1">
                    &ldquo;{postTitle}&rdquo;
                  </p>
                )}

                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {pub.author_name ?? "Unknown"}
                </p>

                {pub.description && (
                  <p
                    className={`text-sm text-muted-foreground mb-4 ${
                      viewMode === "list" ? "line-clamp-2" : "line-clamp-3"
                    }`}
                  >
                    {pub.description}
                  </p>
                )}

                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {sub ? (
                    <button
                      disabled
                      className="flex-1 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg shadow-sm cursor-default"
                    >
                      <Check className="w-4 h-4 inline mr-1" />
                      Subscribed
                    </button>
                  ) : (
                    <button
                      onClick={() => onSubscribe(pub)}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                    href={
                      pub.custom_domain
                        ? `https://${pub.custom_domain}`
                        : `https://${pub.subdomain}.substack.com`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-muted/60 text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted hover:text-foreground transition-all flex items-center gap-2"
                    title="Visit website"
                  >
                    <ArrowSquareOut className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Grid of category feed items. */
function SubstackFeedGrid({
  items,
  viewMode,
  subscribedFeedUrls,
  subscribing,
  onSubscribe,
  onPreview,
}: {
  items: SubstackFeedItem[];
  viewMode: ViewMode;
  subscribedFeedUrls: Set<string>;
  subscribing: Set<string>;
  onSubscribe: (pub: SubstackPublication) => void;
  onPreview: (pub: SubstackPublication) => void;
}) {
  return (
    <div
      className={
        viewMode === "grid"
          ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          : "flex flex-col gap-3 max-w-4xl mx-auto"
      }
    >
      {items
        .filter((item) => item.type === "post" && item.post && item.publication)
        .map((item, idx) => {
          const pub = item.publication!;
          const post = item.post!;

          const feedUrl = pub.custom_domain
            ? `https://${pub.custom_domain}/feed`
            : `https://${pub.subdomain}.substack.com/feed`;
          const sub = subscribedFeedUrls.has(feedUrl);
          const loading = subscribing.has(`substack-${pub.id}`);

          return (
            <div
              key={`${item.entity_key}-${idx}`}
              onClick={() => onPreview(pub)}
              className="group relative bg-card/60 backdrop-blur-sm rounded-xl border border-border/70 hover:border-orange-500/50 hover:bg-card/80 transition-all duration-200 overflow-hidden cursor-pointer"
            >
              {sub && (
                <div className="absolute top-3 right-3 z-10">
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full shadow-sm">
                    <Check className="w-3 h-3" />
                    <span>Subscribed</span>
                  </div>
                </div>
              )}

              <div className={`p-5 ${viewMode === "list" ? "flex items-start gap-4" : ""}`}>
                <div
                  className={`${
                    viewMode === "grid" ? "mb-3" : "flex-shrink-0 mt-1"
                  } w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center border border-orange-200 dark:border-orange-800 overflow-hidden flex-shrink-0`}
                >
                  {pub.logo_url ? (
                    <img src={pub.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Rss className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  )}
                </div>

                <div className={viewMode === "grid" ? "" : "flex-1 min-w-0"}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                      {pub.name}
                    </span>
                  </div>

                  <h3 className="font-semibold text-foreground mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-2">
                    {post.title}
                  </h3>

                  {post.description && (
                    <p className={`text-sm text-muted-foreground mb-4 ${viewMode === "list" ? "line-clamp-1" : "line-clamp-2"}`}>
                      {post.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {sub ? (
                      <button disabled className="flex-1 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg shadow-sm cursor-default">
                        <Check className="w-4 h-4 inline mr-1" /> Subscribed
                      </button>
                    ) : (
                      <button
                        onClick={() => onSubscribe(pub)}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Rss className="w-4 h-4" /> Subscribe
                          </>
                        )}
                      </button>
                    )}
                    <a
                      href={pub.custom_domain ? `https://${pub.custom_domain}` : `https://${pub.subdomain}.substack.com`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-muted/60 text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted hover:text-foreground transition-all flex items-center gap-2"
                    >
                      <ArrowSquareOut className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
