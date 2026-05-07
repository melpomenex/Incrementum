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
  Link,
  Pencil,
  ExternalLink,
  FileAudio,
  FileText,
  MessageSquare,
  Copy,
  Check,
} from "lucide-react";
import {
  type PodcastFeed,
  type PodcastEpisode,
  type PodcastTranscriptResponse,
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
  renamePodcastFeed,
  transcribePodcastEpisode,
  getPodcastTranscript,
  cancelPodcastTranscription,
  setFeedAutoTranscribe,
} from "../../api/podcast";
import { isTauri, listen } from "../../lib/tauri";
import {
  useContextMenu,
  ContextMenu,
  ContextMenuItemType,
  type ContextMenuItem,
} from "../common/ContextMenu";
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

  // Context menu state
  const feedContextMenu = useContextMenu("feed-context-menu");
  const episodeContextMenu = useContextMenu("episode-context-menu");

  // Listen for transcription events (Tauri only)
  useEffect(() => {
    if (!isTauri()) return;

    const unlisten1 = listen<{ episodeId: string; status: string; progress: number; message?: string }>(
      "podcast://transcription-progress",
      (e) => {
        const { episodeId, status, progress } = e.payload;
        setTranscriptionProgress((prev) => new Map(prev).set(episodeId, { status, progress }));
      },
    );

    const unlisten2 = listen<{ episodeId: string; segmentCount: number; duration: number }>(
      "podcast://transcription-complete",
      (e) => {
        const { episodeId } = e.payload;
        setTranscriptionProgress((prev) => {
          const next = new Map(prev);
          next.delete(episodeId);
          return next;
        });
        // Reload episodes to get updated transcript status
        if (selectedFeedIdRef.current) {
          loadEpisodes(selectedFeedIdRef.current);
        }
        loadFeeds();
      },
    );

    const unlisten3 = listen<{ episodeId: string; error: string }>(
      "podcast://transcription-error",
      (e) => {
        const { episodeId, error } = e.payload;
        setTranscriptionProgress((prev) => {
          const next = new Map(prev);
          next.delete(episodeId);
          return next;
        });
        toast.error("Transcription failed", error);
        // Reload episodes to show error state
        if (selectedFeedIdRef.current) {
          loadEpisodes(selectedFeedIdRef.current);
        }
      },
    );

    return () => {
      unlisten1.then((f) => f());
      unlisten2.then((f) => f());
      unlisten3.then((f) => f());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [contextFeed, setContextFeed] = useState<PodcastFeed | null>(null);
  const [contextEpisode, setContextEpisode] = useState<PodcastEpisode | null>(null);
  const [renamingFeed, setRenamingFeed] = useState<PodcastFeed | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // Transcription state
  const [transcriptionProgress, setTranscriptionProgress] = useState<Map<string, { status: string; progress: number }>>(new Map());
  const [viewingTranscript, setViewingTranscript] = useState<{ episode: PodcastEpisode; transcript: PodcastTranscriptResponse } | null>(null);
  const [transcriptSearchQuery, setTranscriptSearchQuery] = useState("");
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  const [langDialogFeed, setLangDialogFeed] = useState<PodcastFeed | null>(null);
  const [langDialogValue, setLangDialogValue] = useState("");
  const selectedFeedIdRef = useRef(selectedFeedId);
  selectedFeedIdRef.current = selectedFeedId;

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

  // Feed context menu handler
  const handleFeedContextMenu = useCallback(
    (e: React.MouseEvent, feed: PodcastFeed) => {
      e.preventDefault();
      e.stopPropagation();
      setContextFeed(feed);
      feedContextMenu.showMenu(
        { x: e.clientX, y: e.clientY },
        [
          {
            id: "refresh",
            label: "Refresh",
            icon: <RefreshCw className="w-4 h-4" />,
            onClick: () => handleRefreshFeed(feed),
          },
          {
            id: "mark-all-played",
            label: "Mark All as Played",
            icon: <CheckCircle2 className="w-4 h-4" />,
            onClick: async () => {
              const feedEpisodes = await getPodcastEpisodes(feed.id, true);
              const unplayed = feedEpisodes.filter((ep) => !ep.played);
              await Promise.all(unplayed.map((ep) => markEpisodePlayed(ep.id, true)));
              if (selectedFeedId === feed.id) await loadEpisodes(feed.id);
              loadFeeds();
            },
          },
          {
            id: "copy-feed-url",
            label: "Copy Feed URL",
            icon: <Link className="w-4 h-4" />,
            onClick: () => {
              navigator.clipboard.writeText(feed.feedUrl);
            },
          },
          { id: "sep1", type: ContextMenuItemType.Separator, label: "" },
          {
            id: "auto-transcribe",
            label: "Auto-Transcribe New Episodes",
            icon: <FileAudio className="w-4 h-4" />,
            type: ContextMenuItemType.Checkbox,
            checked: feed.autoTranscribe,
            onClick: () => handleToggleAutoTranscribe(feed),
          },
          {
            id: "set-language",
            label: "Set Transcription Language",
            onClick: () => handleSetTranscriptionLanguage(feed),
          },
          { id: "sep1b", type: ContextMenuItemType.Separator, label: "" },
          {
            id: "rename",
            label: "Rename",
            icon: <Pencil className="w-4 h-4" />,
            onClick: () => {
              setRenamingFeed(feed);
              setRenameTitle(feed.title);
            },
          },
          { id: "sep2", type: ContextMenuItemType.Separator, label: "" },
          {
            id: "unsubscribe",
            label: "Unsubscribe",
            icon: <Trash2 className="w-4 h-4" />, 
            type: ContextMenuItemType.Danger,
            onClick: () => handleRemoveSubscription(feed.id),
          },
        ]
      );
    },
    [feedContextMenu, loadFeeds, loadEpisodes, selectedFeedId]
  );

  // Episode context menu handler
  const handleEpisodeContextMenu = useCallback(
    (e: React.MouseEvent, episode: PodcastEpisode, feed: PodcastFeed) => {
      e.preventDefault();
      e.stopPropagation();
      setContextEpisode(episode);
      episodeContextMenu.showMenu(
        { x: e.clientX, y: e.clientY },
        [
          {
            id: "play",
            label: "Play",
            icon: <Play className="w-4 h-4" />,
            onClick: () => handlePlayEpisode(feed, episode),
          },
          {
            id: "mark-played",
            label: "Mark as Played",
            icon: <CheckCircle2 className="w-4 h-4" />,
            onClick: async () => {
              await markEpisodePlayed(episode.id, true);
              if (selectedFeedId === feed.id) await loadEpisodes(feed.id);
              loadFeeds();
            },
          },
          {
            id: "mark-unplayed",
            label: "Mark as Unplayed",
            icon: <Circle className="w-4 h-4" />,
            onClick: async () => {
              await markEpisodePlayed(episode.id, false);
              if (selectedFeedId === feed.id) await loadEpisodes(feed.id);
              loadFeeds();
            },
          },
          { id: "sep1", type: ContextMenuItemType.Separator, label: "" },
          {
            id: "copy-episode-url",
            label: "Copy Episode URL",
            icon: <Link className="w-4 h-4" />,
            onClick: () => {
              navigator.clipboard.writeText(episode.link || episode.audioUrl);
            },
          },
          {
            id: "open-show-notes",
            label: "Open Show Notes",
            icon: <ExternalLink className="w-4 h-4" />,
            disabled: !episode.link,
            onClick: () => {
              if (episode.link) window.open(episode.link, "_blank");
            },
          },
        ]
      );
    },
    [episodeContextMenu, loadFeeds, loadEpisodes, selectedFeedId]
  );

  // Rename handler
  const handleRenameFeed = async () => {
    if (!renamingFeed || !renameTitle.trim()) return;
    try {
      await renamePodcastFeed(renamingFeed.id, renameTitle.trim());
      setFeeds((prev) =>
        prev.map((f) =>
          f.id === renamingFeed.id ? { ...f, title: renameTitle.trim() } : f
        )
      );
      toast.success("Renamed", `Podcast renamed to "${renameTitle.trim()}"`);
    } catch (error) {
      toast.error(
        "Failed to rename",
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setRenamingFeed(null);
      setRenameTitle("");
    }
  };

  // Transcription handlers
  const handleTranscribe = async (episodeId: string) => {
    try {
      setTranscriptionProgress((prev) => new Map(prev).set(episodeId, { status: "starting", progress: 0 }));
      await transcribePodcastEpisode(episodeId);
    } catch (error) {
      setTranscriptionProgress((prev) => {
        const next = new Map(prev);
        next.delete(episodeId);
        return next;
      });
      toast.error(
        "Failed to start transcription",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  const handleCancelTranscription = async (episodeId: string) => {
    try {
      await cancelPodcastTranscription(episodeId);
      setTranscriptionProgress((prev) => {
        const next = new Map(prev);
        next.delete(episodeId);
        return next;
      });
      if (selectedFeedId) loadEpisodes(selectedFeedId);
    } catch (error) {
      toast.error("Failed to cancel", error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleViewTranscript = async (episode: PodcastEpisode) => {
    try {
      const transcript = await getPodcastTranscript(episode.id);
      setViewingTranscript({ episode, transcript });
      setTranscriptSearchQuery("");
      setTranscriptCopied(false);
    } catch (error) {
      toast.error("Failed to load transcript", error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleCopyTranscript = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setTranscriptCopied(true);
      setTimeout(() => setTranscriptCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleChatAboutThis = async (episode: PodcastEpisode, feed: PodcastFeed) => {
    // Create a document with the transcript for the assistant
    const transcriptText = episode.transcriptText || (await getPodcastTranscript(episode.id)).text;
    if (!transcriptText) {
      toast.error("No transcript available", "Transcribe the episode first");
      return;
    }

    try {
      const { createDocument } = await import("../../api/documents");
      const title = `${episode.title} (Transcript)`;
      const doc = await createDocument(title, `podcast://${episode.id}`, "transcript");
      // Update the document content with the transcript text
      const { updateDocumentContent } = await import("../../api/documents");
      await updateDocumentContent(doc.id, transcriptText);
      toast.success("Document created", `Created "${title}" for AI chat`);
    } catch (error) {
      toast.error("Failed to create document", error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleToggleAutoTranscribe = async (feed: PodcastFeed) => {
    try {
      const newEnabled = !feed.autoTranscribe;
      await setFeedAutoTranscribe(feed.id, newEnabled, feed.transcribeLanguage || undefined);
      setFeeds((prev) =>
        prev.map((f) => (f.id === feed.id ? { ...f, autoTranscribe: newEnabled } : f))
      );
      toast.success(
        newEnabled ? "Auto-transcribe enabled" : "Auto-transcribe disabled",
        newEnabled ? `New episodes of "${feed.title}" will be transcribed automatically` : `"${feed.title}" won't auto-transcribe new episodes`
      );
    } catch (error) {
      toast.error("Failed to update", error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleSetTranscriptionLanguage = async (feed: PodcastFeed) => {
    setLangDialogFeed(feed);
    setLangDialogValue(feed.transcribeLanguage || "en");
  };

  const handleSaveTranscriptionLanguage = async () => {
    if (!langDialogFeed) return;
    try {
      await setFeedAutoTranscribe(langDialogFeed.id, langDialogFeed.autoTranscribe, langDialogValue || undefined);
      setFeeds((prev) =>
        prev.map((f) => (f.id === langDialogFeed.id ? { ...f, transcribeLanguage: langDialogValue || null } : f))
      );
      setLangDialogFeed(null);
      setLangDialogValue("");
      toast.success("Language updated");
    } catch (error) {
      toast.error("Failed to update language", error instanceof Error ? error.message : "Unknown error");
    }
  };

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
                    onContextMenu={(e) => handleFeedContextMenu(e, feed)}
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
                        onContextMenu={(e) => handleEpisodeContextMenu(e, episode, selectedFeed)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Play button */}
                          <button
                            onClick={() => handlePlayEpisode(selectedFeed, episode)}
                            className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity flex items-center justify-center"
                            title={playingEpisode?.episode.id === episode.id ? "Pause" : "Play"}
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

                          {/* Transcription status indicators */}
                          {(() => {
                            const progress = transcriptionProgress.get(episode.id);
                            if (progress) {
                              // In progress
                              return (
                                <div className="flex items-center gap-2">
                                  <div className="flex-shrink-0 w-10 h-10 border border-primary/30 rounded-full flex items-center justify-center">
                                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                  </div>
                                </div>
                              );
                            }
                            if (episode.transcriptStatus === "done") {
                              return (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleViewTranscript(episode)}
                                    className="flex-shrink-0 w-10 h-10 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors flex items-center justify-center"
                                    title="View Transcript"
                                  >
                                    <FileText className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleChatAboutThis(episode, selectedFeed)}
                                    className="flex-shrink-0 w-10 h-10 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors flex items-center justify-center"
                                    title="Chat About This"
                                  >
                                    <MessageSquare className="w-5 h-5" />
                                  </button>
                                </div>
                              );
                            }
                            if (episode.transcriptStatus === "error") {
                              return (
                                <button
                                  onClick={() => handleTranscribe(episode.id)}
                                  className="flex-shrink-0 w-10 h-10 border border-destructive/30 text-destructive rounded-full hover:bg-destructive/10 transition-colors flex items-center justify-center"
                                  title={`Retry transcription: ${episode.transcriptError || "Unknown error"}`}
                                >
                                  <AlertCircle className="w-5 h-5" />
                                </button>
                              );
                            }
                            // No transcript yet
                            return (
                              <button
                                onClick={() => handleTranscribe(episode.id)}
                                className="flex-shrink-0 w-10 h-10 border border-border text-muted-foreground rounded-full hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center"
                                title="Transcribe with Whisper"
                              >
                                <FileAudio className="w-5 h-5" />
                              </button>
                            );
                          })()}

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

                            {/* Transcription progress bar */}
                            {(() => {
                              const progress = transcriptionProgress.get(episode.id);
                              if (!progress) {
                                // Error state
                                if (episode.transcriptStatus === "error") {
                                  return (
                                    <div className="mt-2 flex items-center gap-2 text-xs">
                                      <span className="text-destructive">Transcription Failed: {episode.transcriptError || "Unknown error"}</span>
                                      <button
                                        onClick={() => handleTranscribe(episode.id)}
                                        className="text-primary hover:underline"
                                      >
                                        Retry
                                      </button>
                                    </div>
                                  );
                                }
                                // Done state
                                if (episode.transcriptStatus === "done") {
                                  return (
                                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                      <FileText className="w-3 h-3" />
                                      <span>Transcript available</span>
                                    </div>
                                  );
                                }
                                return null;
                              }
                              return (
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                      {progress.status === "downloading"
                                        ? "Downloading audio..."
                                        : progress.status === "starting"
                                        ? "Starting transcription..."
                                        : `Transcribing... ${progress.progress}%`}
                                    </span>
                                    <button
                                      onClick={() => handleCancelTranscription(episode.id)}
                                      className="text-muted-foreground hover:text-destructive transition-colors"
                                      title="Cancel"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary transition-all duration-300 rounded-full"
                                      style={{ width: `${Math.max(progress.progress, 5)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })()}
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
        <div className="border-t border-border bg-card h-64 flex-shrink-0 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
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
          <div className="flex-1 min-h-0">
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

      {/* Transcript Viewer Panel */}
      {viewingTranscript && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setViewingTranscript(null)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-[500px] bg-card border-l border-border flex flex-col shadow-lg">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {viewingTranscript.episode.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Transcript
                </p>
              </div>
              <button
                onClick={() => setViewingTranscript(null)}
                className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Actions bar */}
            <div className="p-3 border-b border-border flex items-center gap-2">
              <button
                onClick={() => handleCopyTranscript(viewingTranscript.transcript.text)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 transition-colors",
                  transcriptCopied
                    ? "bg-green-500/10 text-green-600"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {transcriptCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {transcriptCopied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => {
                  const feed = feeds.find((f) => f.id === viewingTranscript.episode.feedId);
                  if (feed) {
                    handleChatAboutThis(viewingTranscript.episode, feed);
                  }
                }}
                className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg flex items-center gap-1 transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                Chat About This
              </button>
              {/* Search */}
              <div className="flex-1" />
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <input
                  type="text"
                  value={transcriptSearchQuery}
                  onChange={(e) => setTranscriptSearchQuery(e.target.value)}
                  placeholder="Search transcript..."
                  className="pl-7 pr-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-36"
                />
              </div>
            </div>

            {/* Transcript content */}
            <div className="flex-1 overflow-y-auto p-4">
              {viewingTranscript.transcript.segments.length > 0 ? (
                viewingTranscript.transcript.segments
                  .filter((seg) =>
                    !transcriptSearchQuery ||
                    seg.text.toLowerCase().includes(transcriptSearchQuery.toLowerCase())
                  )
                  .map((seg, i) => {
                    const startSec = seg.start / 1000;
                    const mm = String(Math.floor(startSec / 60)).padStart(2, "0");
                    const ss = String(Math.floor(startSec % 60)).padStart(2, "0");
                    return (
                      <div key={i} className="mb-3">
                        <span className="text-[10px] text-muted-foreground font-mono mr-2">[{mm}:{ss}]</span>
                        <span className="text-sm text-foreground leading-relaxed">{seg.text}</span>
                      </div>
                    );
                  })
              ) : (
                // No segments — show full text with search filter
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {transcriptSearchQuery
                    ? viewingTranscript.transcript.text
                        .split(/(?<=[.!?])\s+/)
                        .filter((sentence) =>
                          sentence.toLowerCase().includes(transcriptSearchQuery.toLowerCase())
                        )
                        .join(" ")
                    : viewingTranscript.transcript.text}
                  {transcriptSearchQuery &&
                    viewingTranscript.transcript.text
                      .split(/(?<=[.!?])\s+/)
                      .filter((s) => s.toLowerCase().includes(transcriptSearchQuery.toLowerCase()))
                      .length === 0 && (
                      <p className="text-muted-foreground mt-2">No matches found.</p>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Set Transcription Language Dialog */}
      {langDialogFeed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-foreground mb-4">Set Transcription Language</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Language code for Whisper transcription (e.g., "en", "es", "fr", "de"). Use "auto" for auto-detect.
            </p>
            <input
              type="text"
              value={langDialogValue}
              onChange={(e) => setLangDialogValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTranscriptionLanguage();
                if (e.key === "Escape") {
                  setLangDialogFeed(null);
                  setLangDialogValue("");
                }
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              placeholder="en"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setLangDialogFeed(null);
                  setLangDialogValue("");
                }}
                className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTranscriptionLanguage}
                disabled={!langDialogValue.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feed Context Menu */}
      <ContextMenu
        menuId="feed-context-menu"
        items={feedContextMenu.items}
        visible={feedContextMenu.visible}
        position={feedContextMenu.position}
        onClose={feedContextMenu.hideMenu}
      />

      {/* Episode Context Menu */}
      <ContextMenu
        menuId="episode-context-menu"
        items={episodeContextMenu.items}
        visible={episodeContextMenu.visible}
        position={episodeContextMenu.position}
        onClose={episodeContextMenu.hideMenu}
      />

      {/* Rename Feed Dialog */}
      {renamingFeed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-foreground mb-4">Rename Podcast</h2>
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameFeed();
                if (e.key === "Escape") {
                  setRenamingFeed(null);
                  setRenameTitle("");
                }
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setRenamingFeed(null);
                  setRenameTitle("");
                }}
                className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameFeed}
                disabled={!renameTitle.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
