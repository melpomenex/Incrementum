import { useState, useEffect, useRef, useCallback } from "react";
import {
  Rss,
  Play,
  Plus,
  Search,
  Trash2,
  Clock,
  CheckCircle2,
  Circle,
  RefreshCw,
  Globe,
  Filter,
  Loader2,
  X,
  Pause,
  AlertCircle,
} from "lucide-react";
import {
  type PodcastFeed,
  type PodcastEpisode,
  subscribeToPodcast,
  unsubscribeFromPodcast,
  getSubscribedPodcasts,
  refreshFeed,
  getPodcastEpisodes,
  markEpisodePlayed,
  parsePodcastFeed,
  formatDuration,
  isValidPodcastUrl,
  discoverPodcasts,
} from "../../api/podcast";
import { useI18n } from "../../lib/i18n";
import { useToast } from "../common/Toast";
import { AudiobookViewer } from "../viewer/AudiobookViewer";
import { cn } from "../../utils";

interface PodcastManagerProps {
  onPlayEpisode?: (feed: PodcastFeed, episode: PodcastEpisode) => void;
}

export function PodcastManager({ onPlayEpisode }: PodcastManagerProps) {
  const { t } = useI18n();
  const toast = useToast();
  const [feeds, setFeeds] = useState<PodcastFeed[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<"all" | "unplayed" | "inprogress">("all");
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverResults, setDiscoverResults] = useState<
    Awaited<ReturnType<typeof parsePodcastFeed>>[]
  >([]);
  const [isLoadingFeeds, setIsLoadingFeeds] = useState(true);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [playingEpisode, setPlayingEpisode] = useState<{ episode: PodcastEpisode; feed: PodcastFeed } | null>(null);
  const [refreshErrors, setRefreshErrors] = useState<Record<string, string>>({});
  const migrationRun = useRef(false);

  const selectedFeed = feeds.find((f) => f.id === selectedFeedId) ?? null;

  // Load subscriptions
  const loadFeeds = useCallback(async () => {
    try {
      setIsLoadingFeeds(true);
      const result = await getSubscribedPodcasts();
      setFeeds(result);
    } catch (error) {
      console.error("Failed to load podcast feeds:", error);
      toast.error("Failed to load podcasts", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoadingFeeds(false);
    }
  }, [toast]);

  // Load episodes for the selected feed
  const loadEpisodes = useCallback(async (feedId: string) => {
    try {
      setIsLoadingEpisodes(true);
      const result = await getPodcastEpisodes(feedId, true);
      setEpisodes(result);
    } catch (error) {
      console.error("Failed to load episodes:", error);
      toast.error("Failed to load episodes", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoadingEpisodes(false);
    }
  }, [toast]);

  // localStorage migration (Task 9)
  useEffect(() => {
    if (migrationRun.current) return;
    migrationRun.current = true;

    const migrateFromLocalStorage = async () => {
      const stored = localStorage.getItem("podcast_subscriptions");
      if (!stored) return;

      try {
        const oldFeeds = JSON.parse(stored) as Array<{ feedUrl?: string; id: string; title: string }>;
        let migrated = 0;

        for (const oldFeed of oldFeeds) {
          const feedUrl = oldFeed.feedUrl;
          if (!feedUrl) continue;
          try {
            await subscribeToPodcast(feedUrl);
            migrated++;
          } catch (error) {
            console.error(`Migration failed for ${feedUrl}:`, error);
          }
        }

        localStorage.removeItem("podcast_subscriptions");
        if (migrated > 0) {
          toast.success("Migration complete", `Migrated ${migrated} podcast subscriptions`);
        }
      } catch (error) {
        console.error("Podcast migration failed:", error);
      }

      // Load feeds after migration
      await loadFeeds();
    };

    migrateFromLocalStorage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load feeds on mount (after potential migration)
  useEffect(() => {
    if (!migrationRun.current) return;
    // The migration useEffect handles the initial load
    // This is a safety net for when migration didn't run
    loadFeeds();
  }, [loadFeeds]);

  // Load episodes when a feed is selected
  useEffect(() => {
    if (selectedFeedId) {
      loadEpisodes(selectedFeedId);
    } else {
      setEpisodes([]);
    }
  }, [selectedFeedId, loadEpisodes]);

  // Add new subscription
  const handleAddSubscription = async () => {
    if (!isValidPodcastUrl(newFeedUrl)) {
      toast.error("Invalid URL", "Please enter a valid podcast feed URL");
      return;
    }

    setIsAdding(true);
    try {
      const feed = await subscribeToPodcast(newFeedUrl);
      // Only add the feed and close the dialog on success
      setFeeds((prev) => [...prev, feed]);
      setSelectedFeedId(feed.id);
      setShowAddDialog(false);
      setNewFeedUrl("");
      toast.success("Subscribed", `Added "${feed.title}"`);
    } catch (error) {
      // Show a descriptive error — don't add a broken feed
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(
        "Failed to subscribe",
        msg.includes("fetch")
          ? "Could not reach the feed URL. Check the address and try again."
          : msg.includes("parse")
            ? "The URL doesn't appear to be a valid podcast feed."
            : msg
      );
    } finally {
      setIsAdding(false);
    }
  };

  // Remove subscription
  const handleRemoveSubscription = async (feedId: string) => {
    if (!confirm(t("podcastManager.unsubscribeConfirm"))) return;

    try {
      await unsubscribeFromPodcast(feedId);
      setFeeds((prev) => prev.filter((f) => f.id !== feedId));
      if (selectedFeedId === feedId) {
        setSelectedFeedId(null);
      }
      toast.success("Unsubscribed", "Podcast removed");
    } catch (error) {
      toast.error(
        "Failed to unsubscribe",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // Play episode
  const handlePlayEpisode = (feed: PodcastFeed, episode: PodcastEpisode) => {
    onPlayEpisode?.(feed, episode);
    setPlayingEpisode({ episode, feed });
  };

  // Refresh episodes after one finishes playing
  const handleEpisodeEnded = useCallback(() => {
    if (selectedFeedId) {
      loadEpisodes(selectedFeedId);
    }
    loadFeeds();
  }, [selectedFeedId, loadEpisodes, loadFeeds]);

  // Mark as played/unplayed
  const handleTogglePlayed = async (episodeId: string, currentlyPlayed: boolean) => {
    try {
      await markEpisodePlayed(episodeId, !currentlyPlayed);
      setEpisodes((prev) =>
        prev.map((ep) => (ep.id === episodeId ? { ...ep, played: !currentlyPlayed } : ep))
      );
      // Update unplayed counts in feed list
      setFeeds((prev) =>
        prev.map((f) => {
          if (f.id === selectedFeedId) {
            const newUnplayed = episodes.filter((ep) => ep.id === episodeId
              ? !currentlyPlayed
              : !ep.played).length;
            return { ...f, unplayedCount: newUnplayed };
          }
          return f;
        })
      );
    } catch (error) {
      toast.error(
        "Failed to update episode",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // Refresh feed
  const handleRefreshFeed = async (feed: PodcastFeed) => {
    setIsRefreshing(feed.id);
    // Clear previous error for this feed while refreshing
    setRefreshErrors((prev) => {
      const next = { ...prev };
      delete next[feed.id];
      return next;
    });
    try {
      const updated = await refreshFeed(feed.id);
      setFeeds((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      await loadEpisodes(feed.id);
      toast.success("Refreshed", `"${updated.title}" updated`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error("Refresh failed", msg);
      // Store the error so we can show a retry button — do NOT clear episodes
      setRefreshErrors((prev) => ({ ...prev, [feed.id]: msg }));
    } finally {
      setIsRefreshing(null);
    }
  };

  // Discover podcasts
  const handleDiscover = async () => {
    setShowDiscover(true);
    try {
      const feedUrls = await discoverPodcasts();
      const results = await Promise.allSettled(
        feedUrls.map((url) => parsePodcastFeed(url))
      );
      setDiscoverResults(
        results
          .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof parsePodcastFeed>>> =>
            r.status === "fulfilled" && r.value !== null
          )
          .map((r) => r.value)
      );
    } catch (error) {
      console.error("Failed to discover podcasts:", error);
    }
  };

  // Subscribe from discover
  const handleSubscribeFromDiscover = async (feedUrl: string) => {
    try {
      const feed = await subscribeToPodcast(feedUrl);
      setFeeds((prev) => [...prev, feed]);
      setSelectedFeedId(feed.id);
      setShowDiscover(false);
      toast.success("Subscribed", `Added "${feed.title}"`);
    } catch (error) {
      toast.error(
        "Failed to subscribe",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // Filter episodes
  const getFilteredEpisodes = (): PodcastEpisode[] => {
    switch (filter) {
      case "unplayed":
        return episodes.filter((ep) => !ep.played);
      case "inprogress":
        return episodes.filter(
          (ep) => ep.playbackPosition > 0 && !ep.played
        );
      default:
        return episodes;
    }
  };

  // Get total unplayed count
  const totalUnplayed = feeds.reduce((acc, feed) => acc + (feed.unplayedCount ?? 0), 0);

  return (
    <div className="h-full flex relative">
      {/* Sidebar - Podcast List */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Rss className="w-5 h-5 text-primary" />
              Podcasts
            </h2>
            <div className="flex gap-1">
              <button
                onClick={() => setShowAddDialog(true)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="Add podcast"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={handleDiscover}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="Discover podcasts"
              >
                <Globe className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search podcasts..."
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Podcast List */}
        <div className="overflow-y-auto flex-1">
          {isLoadingFeeds ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : feeds.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Rss className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="mb-2">No podcasts yet</p>
              <button
                onClick={() => setShowAddDialog(true)}
                className="text-primary hover:underline"
              >
                Add your first podcast
              </button>
            </div>
          ) : (
            <div>
              {feeds
                .filter((feed) =>
                  feed.title.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((feed) => (
                  <button
                    key={feed.id}
                    onClick={() => setSelectedFeedId(feed.id)}
                    className={`w-full p-3 text-left hover:bg-muted transition-colors border-b border-border ${
                      selectedFeedId === feed.id ? "bg-muted/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Cover art */}
                      {feed.imageUrl ? (
                        <img
                          src={feed.imageUrl}
                          alt={feed.title}
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          <Rss className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                          {feed.title}
                          {refreshErrors[feed.id] && (
                            <span title={`Refresh failed: ${refreshErrors[feed.id]}`}>
                              <AlertCircle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                            </span>
                          )}
                        </h3>
                        {feed.author && (
                          <p className="text-xs text-muted-foreground truncate">
                            {feed.author}
                          </p>
                        )}
                        {(feed.unplayedCount ?? 0) > 0 && (
                          <div className="mt-1 flex items-center gap-1">
                            <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-primary-foreground bg-primary rounded-full">
                              {feed.unplayedCount > 99 ? "99+" : feed.unplayedCount}
                            </span>
                            <span className="text-xs text-primary">unplayed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-card border-t border-border">
          <div className="text-sm text-muted-foreground">
            {totalUnplayed} unplayed episode{totalUnplayed !== 1 ? "s" : ""} across{" "}
            {feeds.length} podcast{feeds.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Main Content - Episodes */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {selectedFeed ? (
          <>
            {/* Feed Header */}
            <div className="p-6 border-b border-border bg-card">
              <div className="flex items-start gap-4">
                {selectedFeed.imageUrl && (
                  <img
                    src={selectedFeed.imageUrl}
                    alt={selectedFeed.title}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground mb-1">
                    {selectedFeed.title}
                  </h2>
                  {selectedFeed.author && (
                    <p className="text-muted-foreground mb-2">{selectedFeed.author}</p>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {selectedFeed.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRefreshFeed(selectedFeed)}
                      disabled={isRefreshing === selectedFeed.id}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1",
                        refreshErrors[selectedFeed.id]
                          ? "bg-yellow-500/10 text-yellow-600 border border-yellow-500/30"
                          : "bg-secondary text-secondary-foreground"
                      )}
                    >
                      {isRefreshing === selectedFeed.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      {refreshErrors[selectedFeed.id] ? "Retry" : "Refresh"}
                    </button>
                    <button
                      onClick={() => handleRemoveSubscription(selectedFeed.id)}
                      className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Unsubscribe
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Episodes List */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {isLoadingEpisodes ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Filter */}
                  <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as "all" | "unplayed" | "inprogress")}
                      className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="all">All Episodes</option>
                      <option value="unplayed">Unplayed</option>
                      <option value="inprogress">In Progress</option>
                    </select>
                    <span className="text-sm text-muted-foreground">
                      {getFilteredEpisodes().length} episodes
                    </span>
                  </div>

                  {/* Episodes */}
                  <div className="space-y-2">
                    {getFilteredEpisodes().map((episode) => (
                      <div
                        key={episode.id}
                        className={cn(
                          "p-4 bg-card border rounded-lg hover:border-primary/50 transition-colors",
                          playingEpisode?.episode.id === episode.id ? "border-primary" : "border-border"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {/* Play button */}
                          <button
                            onClick={() => handlePlayEpisode(selectedFeed, episode)}
                            className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity flex items-center justify-center"
                          >
                            {playingEpisode?.episode.id === episode.id ? (
                              <Pause className="w-5 h-5" fill="currentColor" />
                            ) : (
                              <Play className="w-5 h-5" fill="currentColor" />
                            )}
                          </button>

                          {/* Now Playing indicator */}
                          {playingEpisode?.episode.id === episode.id && (
                            <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                              <div className="flex gap-0.5">
                                {[1, 2, 3].map(i => (
                                  <div key={i} className="w-0.5 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                                ))}
                              </div>
                              Now Playing
                            </div>
                          )}

                          {/* Episode info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-foreground mb-1">
                              {episode.title}
                            </h3>
                            {episode.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                {episode.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(episode.duration || 0)}
                              </span>
                              {episode.publishedDate && (
                                <span>
                                  {new Date(episode.publishedDate).toLocaleDateString()}
                                </span>
                              )}
                              {episode.playbackPosition > 0 && !episode.played && (
                                <span className="text-primary">
                                  {Math.round(
                                    (episode.playbackPosition / (episode.duration || 1)) * 100
                                  )}
                                  % played
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <button
                            onClick={() => handleTogglePlayed(episode.id, episode.played)}
                            className={`p-2 rounded transition-colors ${
                              episode.played
                                ? "text-primary bg-primary/10"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                            title={episode.played ? "Mark as unplayed" : "Mark as played"}
                          >
                            {episode.played ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}

                    {getFilteredEpisodes().length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No episodes match the current filter</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          // Empty state
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Rss className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Select a podcast to view episodes</p>
              <p className="text-sm">
                {feeds.length > 0
                  ? "Choose from your subscriptions on the left"
                  : "Add your first podcast to get started"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Inline podcast player */}
      {playingEpisode && (
        <div className="border-t border-border bg-card max-h-48 overflow-hidden flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <span className="text-sm font-medium text-foreground truncate">
              Now Playing: {playingEpisode.episode.title}
            </span>
            <button
              onClick={() => setPlayingEpisode(null)}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <AudiobookViewer
            document={{
              id: playingEpisode.episode.id,
              title: playingEpisode.episode.title,
              filePath: "",
              fileType: "audio",
              content: "",
              metadata: {},
              createdAt: playingEpisode.episode.publishedDate
                ? new Date(playingEpisode.episode.publishedDate).toISOString()
                : new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as any}
            remoteAudioUrl={playingEpisode.episode.audioUrl}
            episodeId={playingEpisode.episode.id}
            episodeTitle={playingEpisode.episode.title}
            podcastTitle={playingEpisode.feed.title}
            onEpisodeEnded={handleEpisodeEnded}
          />
        </div>
      )}

      {/* Add Podcast Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-foreground mb-4">Add Podcast</h2>
            <input
              type="url"
              value={newFeedUrl}
              onChange={(e) => setNewFeedUrl(e.target.value)}
              placeholder="https://example.com/podcast/feed.xml"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSubscription();
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewFeedUrl("");
                }}
                className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubscription}
                disabled={isAdding || !newFeedUrl}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discover Dialog */}
      {showDiscover && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Discover Podcasts</h2>
              <button
                onClick={() => setShowDiscover(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {discoverResults.map((result) => (
                <div
                  key={result.feedUrl}
                  className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {result.imageUrl && (
                    <img
                      src={result.imageUrl}
                      alt={result.title}
                      className="w-full h-32 object-cover rounded mb-2"
                    />
                  )}
                  <h3 className="font-medium text-foreground text-sm mb-1">{result.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {result.description}
                  </p>
                  <button
                    onClick={() => handleSubscribeFromDiscover(result.feedUrl)}
                    className="w-full px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
                  >
                    Subscribe
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
