/**
 * DiscoverSitesPanel
 * Full-screen discovery browser for curated and auto-discovered RSS sources.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  X,
} from "lucide-react";
import {
  deleteDiscoveredSiteAuto,
  getDiscoveredSitesAuto,
  refreshDiscoveriesAuto,
  type RssDiscoveredSite,
} from "../../api/rss-discovery";
import {
  getSubscribedFeedsAuto,
  subscribeToFeedAuto,
  type Feed,
} from "../../api/rss";
import { invokeCommand, isTauri } from "../../lib/tauri";
import { DiscoverSiteCard } from "./DiscoverSiteCard";
import { useI18n } from "../../lib/i18n";

interface DiscoverSitesPanelProps {
  onClose: () => void;
  onSubscribe?: (feed: Feed) => void;
}

const ALL_CATEGORY = "All Sites";

function normalizeUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin}${pathname}`.toLowerCase();
  } catch {
    return url.trim().replace(/\/+$/, "").toLowerCase();
  }
}

function tokenize(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function getDomain(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

export function DiscoverSitesPanel({ onClose, onSubscribe }: DiscoverSitesPanelProps) {
  const { t } = useI18n();
  const [catalogVisibleCount, setCatalogVisibleCount] = useState(24);
  const [sites, setSites] = useState<RssDiscoveredSite[]>([]);
  const [subscribedFeeds, setSubscribedFeeds] = useState<Feed[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const [feedOnly, setFeedOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const [subscribedKeys, setSubscribedKeys] = useState<Set<string>>(new Set());

  const loadSites = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await getDiscoveredSitesAuto(500, 0);
      setSites(all);
    } catch (err) {
      console.error("[Discover] Failed to load sites:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSubscriptions = useCallback(async () => {
    try {
      const feeds = await getSubscribedFeedsAuto();
      setSubscribedFeeds(feeds);
      const next = new Set<string>();
      feeds.forEach((feed) => {
        next.add(normalizeUrl(feed.feedUrl));
        next.add(normalizeUrl(feed.link));
      });
      setSubscribedKeys(next);
    } catch (err) {
      console.error("[Discover] Failed to load subscriptions:", err);
    }
  }, []);

  useEffect(() => {
    void loadSites();
    void loadSubscriptions();
  }, [loadSites, loadSubscriptions]);

  useEffect(() => {
    const seedIfEmpty = async () => {
      if (!isTauri()) return;
      try {
        const existing = await getDiscoveredSitesAuto(1, 0);
        if (existing.length > 0) return;
        setIsSeeding(true);
        try {
          await invokeCommand<number>("seed_curated_feeds", {});
        } catch {
          return;
        }
        await loadSites();
      } catch {
        return;
      } finally {
        setIsSeeding(false);
      }
    };
    void seedIfEmpty();
  }, [loadSites]);

  const categoryGroups = useMemo(() => {
    const groups = new Map<string, RssDiscoveredSite[]>();
    sites.forEach((site) => {
      const category = site.similarity_source || "Other";
      const existing = groups.get(category) || [];
      existing.push(site);
      groups.set(category, existing);
    });
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [sites]);

  const visibleSites = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let filtered = sites.filter((site) => {
      if (activeCategory !== ALL_CATEGORY && (site.similarity_source || "Other") !== activeCategory) {
        return false;
      }
      if (feedOnly && !site.feed_url) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        site.title.toLowerCase().includes(query) ||
        site.url.toLowerCase().includes(query) ||
        (site.description || "").toLowerCase().includes(query) ||
        (site.similarity_source || "").toLowerCase().includes(query)
      );
    });

    filtered = filtered.sort((a, b) => {
      const dateDiff = new Date(b.discovered_at).getTime() - new Date(a.discovered_at).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.title.localeCompare(b.title);
    });

    return filtered;
  }, [activeCategory, feedOnly, searchQuery, sites]);

  useEffect(() => {
    if (activeCategory === ALL_CATEGORY) return;
    const categoryStillExists = categoryGroups.some(([category]) => category === activeCategory);
    if (!categoryStillExists) {
      setActiveCategory(ALL_CATEGORY);
    }
  }, [activeCategory, categoryGroups]);

  useEffect(() => {
    setCatalogVisibleCount(24);
  }, [activeCategory, feedOnly, searchQuery]);

  const feedReadyCount = useMemo(() => sites.filter((site) => !!site.feed_url).length, [sites]);
  const categoryCount = categoryGroups.length;
  const subscriptionProfile = useMemo(() => {
    const categoryAffinity = new Map<string, number>();
    const tokenAffinity = new Map<string, number>();
    const subscribedDomains = new Set<string>();

    subscribedFeeds.forEach((feed) => {
      const category = (feed.category || "").trim();
      if (category) {
        categoryAffinity.set(category.toLowerCase(), (categoryAffinity.get(category.toLowerCase()) || 0) + 1);
      }

      const tokens = new Set([
        ...tokenize(feed.title),
        ...tokenize(feed.description),
        ...tokenize(feed.category),
      ]);

      tokens.forEach((token) => {
        tokenAffinity.set(token, (tokenAffinity.get(token) || 0) + 1);
      });

      const domain = getDomain(feed.link || feed.feedUrl);
      if (domain) {
        subscribedDomains.add(domain);
      }
    });

    return { categoryAffinity, tokenAffinity, subscribedDomains };
  }, [subscribedFeeds]);

  const recommendationScores = useMemo(() => {
    const scores = new Map<string, number>();

    sites.forEach((site) => {
      const isSubscribed =
        subscribedKeys.has(normalizeUrl(site.feed_url)) ||
        subscribedKeys.has(normalizeUrl(site.url));
      if (isSubscribed || !site.feed_url) {
        return;
      }

      let score = 0;
      const category = (site.similarity_source || "").toLowerCase();
      if (category) {
        score += (subscriptionProfile.categoryAffinity.get(category) || 0) * 10;
      }

      const siteTokens = new Set([
        ...tokenize(site.title),
        ...tokenize(site.description),
        ...tokenize(site.similarity_source),
      ]);

      siteTokens.forEach((token) => {
        score += subscriptionProfile.tokenAffinity.get(token) || 0;
      });

      if (site.description?.trim()) {
        score += 3;
      }

      const siteDomain = getDomain(site.url);
      if (siteDomain && subscriptionProfile.subscribedDomains.has(siteDomain)) {
        score -= 20;
      }

      const ageInDays = Math.max(
        0,
        (Date.now() - new Date(site.discovered_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      score += Math.max(0, 8 - ageInDays);

      scores.set(site.id, score);
    });

    return scores;
  }, [sites, subscribedKeys, subscriptionProfile]);

  const recommendedSites = useMemo(() => {
    return [...sites]
      .filter((site) => recommendationScores.has(site.id))
      .sort((a, b) => {
        const scoreDiff = (recommendationScores.get(b.id) || 0) - (recommendationScores.get(a.id) || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.discovered_at).getTime() - new Date(a.discovered_at).getTime();
      })
      .slice(0, 6);
  }, [sites, recommendationScores]);
  const recentSites = useMemo(() => {
    return [...sites]
      .sort((a, b) => new Date(b.discovered_at).getTime() - new Date(a.discovered_at).getTime())
      .slice(0, 8);
  }, [sites]);
  const trendingCategories = useMemo(() => categoryGroups.slice(0, 6), [categoryGroups]);
  const featuredSiteIds = useMemo(() => {
    if (activeCategory !== ALL_CATEGORY || searchQuery.trim()) {
      return new Set<string>();
    }
    return new Set([
      ...recommendedSites.map((site) => site.id),
      ...recentSites.map((site) => site.id),
    ]);
  }, [activeCategory, recentSites, recommendedSites, searchQuery]);
  const catalogSites = useMemo(() => {
    const baseSites =
      activeCategory === ALL_CATEGORY && !searchQuery.trim()
        ? visibleSites.filter((site) => !featuredSiteIds.has(site.id))
        : visibleSites;
    return baseSites.slice(0, catalogVisibleCount);
  }, [activeCategory, catalogVisibleCount, featuredSiteIds, searchQuery, visibleSites]);
  const hiddenCatalogCount = useMemo(() => {
    const totalCatalogSites =
      activeCategory === ALL_CATEGORY && !searchQuery.trim()
        ? visibleSites.filter((site) => !featuredSiteIds.has(site.id)).length
        : visibleSites.length;
    return Math.max(0, totalCatalogSites - catalogSites.length);
  }, [activeCategory, catalogSites.length, featuredSiteIds, searchQuery, visibleSites]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const discovered = await refreshDiscoveriesAuto();
      if (discovered > 0) {
        await loadSites();
      }
    } catch (err) {
      console.error("[Discover] Failed to refresh:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSeed = async () => {
    if (!isTauri()) return;
    setIsSeeding(true);
    try {
      const inserted = await invokeCommand<number>("seed_curated_feeds", {});
      if (inserted > 0) {
        await loadSites();
      }
    } catch (err) {
      console.error("[Discover] Failed to seed:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSubscribe = async (site: RssDiscoveredSite) => {
    if (!site.feed_url) return;
    setSubscribingId(site.id);
    try {
      const now = new Date().toISOString();
      const feed: Feed = {
        id: `feed-${Date.now()}`,
        title: site.title,
        feedUrl: site.feed_url,
        link: site.url,
        description: site.description || "",
        items: [],
        unreadCount: 0,
        lastUpdated: now,
        lastFetched: now,
        updateInterval: 60,
        subscribeDate: now,
      };
      await subscribeToFeedAuto(feed);
      setSubscribedFeeds((prev) => [...prev, feed]);
      setSubscribedKeys((prev) => {
        const next = new Set(prev);
        next.add(normalizeUrl(site.feed_url));
        next.add(normalizeUrl(site.url));
        return next;
      });
      onSubscribe?.(feed);
    } catch (err) {
      console.error("[Discover] Failed to subscribe:", err);
    } finally {
      setSubscribingId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await deleteDiscoveredSiteAuto(id);
      setSites((prev) => prev.filter((site) => site.id !== id));
    } catch (err) {
      console.error("[Discover] Failed to dismiss:", err);
    }
  };

  const selectedCategoryLabel = activeCategory === ALL_CATEGORY ? t("discoverSites.everything") : activeCategory;

  return (
    <div 
      className="flex h-full flex-col text-foreground"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <div className="border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-5 py-5 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                onClick={onClose}
                className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card/70 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                title={t("common.close")}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-orange-400" />
                  <h2 className="text-2xl font-semibold tracking-tight">{t("discoverSites.title")}</h2>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {t("discoverSites.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFeedOnly((prev) => !prev)}
                className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                  feedOnly
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/70 bg-card/70 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                {t("discoverSites.feedReadyOnly")}
              </button>
              <button
                onClick={() => void handleSeed()}
                disabled={isSeeding}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 transition-colors hover:bg-amber-500/15 disabled:opacity-60"
              >
                <Sparkles className={`h-4 w-4 ${isSeeding ? "animate-spin" : ""}`} />
                {t("discoverSites.seedCurated")}
              </button>
              <button
                onClick={() => void handleRefresh()}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/50 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {t("common.refresh")}
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground lg:hidden"
              >
                <X className="h-4 w-4" />
                {t("common.close")}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
            <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-card px-4 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("discoverSites.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-background/80 py-3 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary/40"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-background/70 px-2.5 py-1">{selectedCategoryLabel}</span>
                <span className="rounded-full bg-background/70 px-2.5 py-1">{t("discoverSites.visibleCount", { count: visibleSites.length })}</span>
                {searchQuery.trim() && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="rounded-full border border-border/70 px-2.5 py-1 text-foreground transition-colors hover:bg-background/80"
                  >
                    {t("discoverSites.clearSearch")}
                  </button>
                )}
              </div>
            </div>
            <StatCard label={t("discoverSites.sites")} value={String(sites.length)} />
            <StatCard label={t("discoverSites.categories")} value={String(categoryCount)} />
            <StatCard label={t("discoverSites.feedReady")} value={String(feedReadyCount)} />
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-full w-full max-w-[1600px] min-h-0 flex-1 gap-6 px-5 py-5 lg:px-8">
        <aside className="hidden w-[280px] shrink-0 self-start lg:block">
          <div className="sticky top-5 max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl border border-border/70 bg-card/80 p-3">
            <p className="px-2 pb-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {t("discoverSites.categories")}
            </p>
            <div className="space-y-1">
              <CategoryButton
                label={ALL_CATEGORY}
                count={sites.length}
                isActive={activeCategory === ALL_CATEGORY}
                onClick={() => setActiveCategory(ALL_CATEGORY)}
              />
              {categoryGroups.map(([category, groupSites]) => (
                <CategoryButton
                  key={category}
                  label={category}
                  count={groupSites.length}
                  isActive={activeCategory === category}
                  onClick={() => setActiveCategory(category)}
                />
              ))}
            </div>
          </div>
        </aside>

        <main className="min-h-0 flex-1 overflow-auto">
          <div className="mb-4 flex gap-2 overflow-auto pb-1 lg:hidden">
            <CategoryButton
              label={ALL_CATEGORY}
              count={sites.length}
              isActive={activeCategory === ALL_CATEGORY}
              onClick={() => setActiveCategory(ALL_CATEGORY)}
              compact
            />
            {categoryGroups.map(([category, groupSites]) => (
              <CategoryButton
                key={category}
                label={category}
                count={groupSites.length}
                isActive={activeCategory === category}
                onClick={() => setActiveCategory(category)}
                compact
              />
            ))}
          </div>

          {(isLoading || isSeeding) ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border/70 bg-card/40 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin" />
              <p className="text-sm">{isSeeding ? t("discoverSites.loadingCurated") : t("discoverSites.loadingDiscovered")}</p>
            </div>
          ) : visibleSites.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card/40 px-6 text-center">
              <Globe className="h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">{t("discoverSites.nothingMatches")}</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {t("discoverSites.nothingMatchesDesc")}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {activeCategory === ALL_CATEGORY && !searchQuery.trim() && (
                <>
                  {recommendedSites.length > 0 && (
                    <section>
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-amber-400" />
                            <h3 className="text-lg font-semibold">{t("discoverSites.recommended")}</h3>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t("discoverSites.recommendedDesc")}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                        {recommendedSites.map((site) => {
                          const isSubscribed =
                            subscribedKeys.has(normalizeUrl(site.feed_url)) ||
                            subscribedKeys.has(normalizeUrl(site.url));
                          return (
                            <DiscoverSiteCard
                              key={`recommended-${site.id}`}
                              site={site}
                              categoryLabel={site.similarity_source || "Other"}
                              isSubscribed={isSubscribed}
                              isSubscribing={subscribingId === site.id}
                              onSubscribe={(next) => void handleSubscribe(next)}
                              onDismiss={(id) => void handleDismiss(id)}
                            />
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {trendingCategories.length > 0 && (
                    <section>
                      <div className="mb-4 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-orange-400" />
                        <h3 className="text-lg font-semibold">{t("discoverSites.trendingCategories")}</h3>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {trendingCategories.map(([category, groupSites]) => (
                          <button
                            key={`trend-${category}`}
                            onClick={() => setActiveCategory(category)}
                            className="rounded-2xl border border-border/70 bg-card/70 p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/30"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-base font-semibold text-foreground">{category}</span>
                              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                {groupSites.length}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {groupSites.slice(0, 3).map((site) => site.title).join(" • ")}
                            </p>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {recentSites.length > 0 && (
                    <section>
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-sky-400" />
                            <h3 className="text-lg font-semibold">{t("discoverSites.recentlyDiscovered")}</h3>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t("discoverSites.recentlyDiscoveredDesc")}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                        {recentSites.map((site) => {
                          const isSubscribed =
                            subscribedKeys.has(normalizeUrl(site.feed_url)) ||
                            subscribedKeys.has(normalizeUrl(site.url));
                          return (
                            <DiscoverSiteCard
                              key={`recent-${site.id}`}
                              site={site}
                              categoryLabel={site.similarity_source || "Other"}
                              isSubscribed={isSubscribed}
                              isSubscribing={subscribingId === site.id}
                              onSubscribe={(next) => void handleSubscribe(next)}
                              onDismiss={(id) => void handleDismiss(id)}
                            />
                          );
                        })}
                      </div>
                    </section>
                  )}
                </>
              )}

              <section>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedCategoryLabel}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {searchQuery.trim()
                        ? t("discoverSites.resultsFor", { query: searchQuery.trim() })
                        : activeCategory === ALL_CATEGORY
                          ? t("discoverSites.everythingDesc")
                          : t("discoverSites.categoryDesc", { category: activeCategory })}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {catalogSites.map((site) => {
                    const isSubscribed =
                      subscribedKeys.has(normalizeUrl(site.feed_url)) ||
                      subscribedKeys.has(normalizeUrl(site.url));
                    return (
                      <DiscoverSiteCard
                        key={site.id}
                        site={site}
                        categoryLabel={site.similarity_source || "Other"}
                        isSubscribed={isSubscribed}
                        isSubscribing={subscribingId === site.id}
                        onSubscribe={(next) => void handleSubscribe(next)}
                        onDismiss={(id) => void handleDismiss(id)}
                      />
                    );
                  })}
                </div>
                {hiddenCatalogCount > 0 && (
                  <div className="mt-5 flex justify-center">
                    <button
                      onClick={() => setCatalogVisibleCount((prev) => prev + 24)}
                      className="rounded-xl border border-border/70 bg-card/70 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/50"
                    >
                      {t("discoverSites.showMore", { count: 24 })}
                      {` `}
                      <span className="text-muted-foreground">{t("discoverSites.remaining", { count: hiddenCatalogCount })}</span>
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function CategoryButton({
  label,
  count,
  isActive,
  onClick,
  compact = false,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const baseClass = compact
    ? "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm"
    : "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm";

  return (
    <button
      onClick={onClick}
      className={`${baseClass} transition-colors ${
        isActive
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <span className="truncate">{label === ALL_CATEGORY ? t("discoverSites.everything") : label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] ${isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
        {count}
      </span>
    </button>
  );
}
