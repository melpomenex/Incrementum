import { useState, useEffect, useRef, useCallback } from "react";
import { sanitizeHtml as _sanitizeHtml } from "../common/RichContentRenderer";
import {
  ArrowsClockwise,
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  ChatCircle,
  Check,
  CheckCircle,
  Circle,
  CircleNotch,
  Clock,
  Copy,
  Download,
  FileAudio,
  Funnel,
  HardDrive,
  Link,
  MagnifyingGlass,
  Pause,
  Pencil,
  Play,
  Plus,
  Rss,
  TextT,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  subscribeToPodcast,
  unsubscribeFromPodcast,
  getSubscribedPodcasts,
  refreshFeed,
  getPodcastEpisodes,
  markEpisodePlayed,
  formatDuration,
  isValidPodcastUrl,
  downloadEpisodeAudio,
  getDownloadedEpisodePath,
  deleteDownloadedEpisode,
  probeAudioDuration,
  searchPodcasts,
  renamePodcastFeed,
  transcribePodcastEpisode,
  getPodcastTranscript,
  cancelPodcastTranscription,
  setFeedAutoTranscribe,
  importPodcastEpisodeAsDocument,
  savePodcastTranscript,
  splitTranscriptIntoSegments,
} from "../../api/podcast";
import type {
  PodcastFeed,
  PodcastEpisode,
  PodcastTranscriptResponse,
  PodcastSearchResult,
} from "../../api/podcast";
import { isTauri, listen } from "../../lib/tauri";
import { useCollectionStore } from "../../stores/collectionStore";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  useContextMenu,
  ContextMenu,
  ContextMenuItemType,
} from "../common/ContextMenu";
import { useI18n } from "../../lib/i18n";
import { useToast } from "../common/Toast";
import { useMobileShell } from "../../hooks/useMobileShell";
import { AudiobookViewer } from "../viewer/AudiobookViewer";
import { TranscriptSync, type TranscriptSearchState } from "./TranscriptSync";
import { cn } from "../../utils";
import { podcastFeedSearch } from "../../utils/podcastSearch";
import { ConfirmDialog, useConfirmDialog } from "../common/ConfirmDialog";
import { AssistantPanel } from "../assistant/AssistantPanel";
import { resolveGenericAssistantContext, type ResolvedAssistantContext } from "../../utils/assistantContext";

interface PodcastManagerProps {
  onPlayEpisode?: (feed: PodcastFeed, episode: PodcastEpisode) => void;
}

export function PodcastManager({ onPlayEpisode }: PodcastManagerProps) {
  const { t } = useI18n();
  const isMobile = useMobileShell();
  const toast = useToast();
  const [feeds, setFeeds] = useState<PodcastFeed[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<"all" | "unplayed" | "inprogress">("all");
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "duration" | "title">("newest");
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const [podcastSearchQuery, setPodcastSearchQuery] = useState("");
  const [podcastSearchResults, setPodcastSearchResults] = useState<PodcastSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoadingFeeds, setIsLoadingFeeds] = useState(true);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [playingEpisode, setPlayingEpisode] = useState<{ episode: PodcastEpisode; feed: PodcastFeed } | null>(null);
  const [playerInitialSeekTime, setPlayerInitialSeekTime] = useState<number | undefined>(undefined);
  const [playerWidth, setPlayerWidth] = useState(() => {
    const saved = localStorage.getItem("podcast-player-width");
    return saved ? parseInt(saved, 10) : 320;
  });
  const [refreshErrors, setRefreshErrors] = useState<Record<string, string>>({});
  const migrationRun = useRef(false);
  const confirmDialog = useConfirmDialog();

  // Context menu state
  const feedContextMenu = useContextMenu("feed-context-menu");
  const episodeContextMenu = useContextMenu("episode-context-menu");

  // Clear selection when search filters out the selected feed
  useEffect(() => {
    if (!selectedFeedId) return;
    const filtered = podcastFeedSearch(searchQuery, feeds);
    if (!filtered.some((f) => f.id === selectedFeedId)) {
      setSelectedFeedId(null);
    }
  }, [searchQuery, feeds, selectedFeedId]);

  const startPlayerResize = useCallback(() => {
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMouseMove = (e: MouseEvent) => {
      setPlayerWidth(Math.max(300, Math.min(1200, window.innerWidth - e.clientX)));
    };
    const onMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setPlayerWidth((w) => {
        localStorage.setItem("podcast-player-width", String(w));
        return w;
      });
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

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
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    const u1 = listen<{ episodeId: string; progress: number }>(
      "podcast://download-progress",
      (e) => {
        const { episodeId, progress } = e.payload;
        setDownloadProgress((prev) => new Map(prev).set(episodeId, progress));
      },
    );

    const u2 = listen<{ episodeId: string; path: string }>(
      "podcast://download-complete",
      (e) => {
        const { episodeId, path } = e.payload;
        setDownloadedEpisodes((prev) => new Map(prev).set(episodeId, path));
        setDownloadingEpisodes((prev) => {
          const next = new Set(prev);
          next.delete(episodeId);
          return next;
        });
        setDownloadProgress((prev) => {
          const next = new Map(prev);
          next.delete(episodeId);
          return next;
        });
        // Probe duration for this episode
        void (async () => {
          const duration = await probeAudioDuration(path);
          if (duration) {
            setEpisodes((prev) =>
              prev.map((ep) => (ep.id === episodeId ? { ...ep, duration } : ep))
            );
          }
        })();
      },
    );

    return () => {
      u1.then((f) => f());
      u2.then((f) => f());
    };
  }, []);

  // Handle play-podcast-episode custom event from command palette
  useEffect(() => {
    const handlePlayPodcastEpisode = async (
      e: CustomEvent<{ feedId: string; episodeId: string; seekTime?: number }>
    ) => {
      const { feedId, episodeId, seekTime } = e.detail;
      setSelectedFeedId(feedId);
      
      try {
        const eps = await getPodcastEpisodes(feedId, true);
        const ep = eps.find((item) => item.id === episodeId);
        const feed = feeds.find((f) => f.id === feedId) || await getSubscribedPodcasts().then(list => list.find(f => f.id === feedId));
        if (ep && feed) {
          setPlayingEpisode({ episode: ep, feed });
          setPlayerInitialSeekTime(seekTime);
        }
      } catch (err) {
        console.error("Failed to handle play-podcast-episode event:", err);
      }
    };

    window.addEventListener("play-podcast-episode" as any, handlePlayPodcastEpisode);
    return () => window.removeEventListener("play-podcast-episode" as any, handlePlayPodcastEpisode);
  }, [feeds]);

  // Check downloaded paths and probe duration for episodes missing it
  useEffect(() => {
    if (!isTauri() || episodes.length === 0) return;
    void (async () => {
      const paths = new Map<string, string>();
      for (const ep of episodes) {
        const path = await getDownloadedEpisodePath(ep.id);
        if (path) paths.set(ep.id, path);
      }
      setDownloadedEpisodes(paths);

      // Probe duration for downloaded episodes missing it
      const needsDuration = [...paths.entries()].filter(
        ([id]) => episodes.find((ep) => ep.id === id && !ep.duration)
      );
      for (const [id, path] of needsDuration) {
        const duration = await probeAudioDuration(path);
        if (duration) {
          setEpisodes((prev) =>
            prev.map((ep) => (ep.id === id ? { ...ep, duration } : ep))
          );
        }
      }
    })();
  }, [episodes]);
  const [_contextFeed, setContextFeed] = useState<PodcastFeed | null>(null);
  const [_contextEpisode, setContextEpisode] = useState<PodcastEpisode | null>(null);
  const [renamingFeed, setRenamingFeed] = useState<PodcastFeed | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // Transcription state
  const [transcriptionProgress, setTranscriptionProgress] = useState<Map<string, { status: string; progress: number }>>(new Map());
  const [viewingTranscript, setViewingTranscript] = useState<{ episode: PodcastEpisode; transcript: PodcastTranscriptResponse } | null>(null);
  const [transcriptSearchQuery, setTranscriptSearchQuery] = useState("");
  // Match state reported by TranscriptSync so the find bar can show N of M and drive prev/next.
  const [transcriptActiveMatchIndex, setTranscriptActiveMatchIndex] = useState(0);
  const [transcriptTotalMatches, setTranscriptTotalMatches] = useState(0);
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  const [chattingTranscript, setChattingTranscript] = useState<{ episode: PodcastEpisode; text: string } | null>(null);
  const [downloadedEpisodes, setDownloadedEpisodes] = useState<Map<string, string>>(new Map());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());
  const [downloadingEpisodes, setDownloadingEpisodes] = useState<Set<string>>(new Set());
  const [langDialogFeed, setLangDialogFeed] = useState<PodcastFeed | null>(null);
  const [langDialogValue, setLangDialogValue] = useState("");
  const selectedFeedIdRef = useRef(selectedFeedId);
  selectedFeedIdRef.current = selectedFeedId;

  const selectedFeed = feeds.find((f) => f.id === selectedFeedId) ?? null;

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

      await loadFeeds();
    };

    migrateFromLocalStorage();
  }, []);

  // Load feeds on mount (after potential migration)
  useEffect(() => {
    if (!migrationRun.current) return;
    // The migration useEffect handles the initial load
    // This is a safety net for when migration didn't run
    loadFeeds();
  }, [loadFeeds]);

  useEffect(() => {
    if (selectedFeedId) {
      loadEpisodes(selectedFeedId);
      setEpisodeSearch("");
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

  const handleRemoveSubscription = async (feedId: string) => {
    const _feed = feeds.find((f) => f.id === feedId);
    confirmDialog.confirm({
      title: "Unsubscribe",
      message: t("podcastManager.unsubscribeConfirm"),
      confirmLabel: "Unsubscribe",
      variant: "danger",
      itemName: "podcast",
      onConfirm: async () => {
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
      },
    });
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

  // Debounced podcast search
  const handleSearchChange = (value: string) => {
    setPodcastSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!value.trim() || value.trim().length < 2) {
      setPodcastSearchResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchPodcasts(value.trim());
        setPodcastSearchResults(results);
      } catch (error) {
        setSearchError(error instanceof Error ? error.message : "Search failed");
        setPodcastSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  // Subscribe from search result (task 5.6 — already-subscribed check)
  const handleSubscribeFromSearch = async (result: PodcastSearchResult) => {
    const alreadySubscribed = feeds.some((f) => f.feedUrl === result.url);
    if (alreadySubscribed) {
      toast.info("Already subscribed", `You're already subscribed to "${result.title}"`);
      return;
    }
    try {
      const feed = await subscribeToPodcast(result.url);
      setFeeds((prev) => [...prev, feed]);
      setSelectedFeedId(feed.id);
      setShowAddDialog(false);
      setPodcastSearchQuery("");
      setPodcastSearchResults([]);
      toast.success("Subscribed", `Added "${feed.title}"`);
    } catch (error) {
      toast.error(
        "Failed to subscribe",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // Funnel episodes
  const getFilteredEpisodes = (): PodcastEpisode[] => {
    let filtered: PodcastEpisode[];
    switch (filter) {
      case "unplayed":
        filtered = episodes.filter((ep) => !ep.played);
        break;
      case "inprogress":
        filtered = episodes.filter(
          (ep) => ep.playbackPosition > 0 && !ep.played
        );
        break;
      default:
        filtered = episodes;
    }

    if (episodeSearch.trim()) {
      const q = episodeSearch.toLowerCase();
      filtered = filtered.filter(
        (ep) =>
          ep.title.toLowerCase().includes(q) ||
          (ep.description ?? "").toLowerCase().includes(q)
      );
    }

    // Sort episodes
    const sorted = [...filtered];
    const toDate = (d: string | null) => d ? new Date(d).getTime() : 0;
    switch (sortOrder) {
      case "oldest":
        sorted.sort((a, b) => toDate(a.publishedDate) - toDate(b.publishedDate));
        break;
      case "duration":
        sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "newest":
      default:
        sorted.sort((a, b) => toDate(b.publishedDate) - toDate(a.publishedDate));
        break;
    }

    return sorted;
  };

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
            icon: <ArrowsClockwise className="w-4 h-4" />,
            onClick: () => handleRefreshFeed(feed),
          },
          {
            id: "mark-all-played",
            label: "Mark All as Played",
            icon: <CheckCircle className="w-4 h-4" />,
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
            icon: <Trash className="w-4 h-4" />, 
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
            icon: <CheckCircle className="w-4 h-4" />,
            onClick: async () => {
              await markEpisodePlayed(episode.id, true);
              if (selectedFeedId === feed.id) await loadEpisodes(feed.id);
              loadFeeds();
            },
          },
          {
            id: "insert-to-queue",
            label: t("podcastManager.insertToQueue"),
            icon: <Plus className="w-4 h-4" />,
            onClick: async () => {
              try {
                await importPodcastEpisodeAsDocument(episode.id, useCollectionStore.getState().activeCollectionId);
                toast.success(t("podcastManager.insertedToQueue"));
              } catch (err) {
                toast.error(t("podcastManager.insertToQueueFailed"), err instanceof Error ? err.message : String(err));
              }
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
            id: "download",
            label: downloadedEpisodes.has(episode.id) ? "Delete Download" : "Download Episode",
            icon: downloadedEpisodes.has(episode.id) ? <Trash className="w-4 h-4" /> : <Download className="w-4 h-4" />,
            onClick: () => {
              if (downloadedEpisodes.has(episode.id)) {
                handleDeleteDownload(episode.id);
              } else {
                handleDownloadEpisode(episode);
              }
            },
          },
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
            icon: <ArrowSquareOut className="w-4 h-4" />,
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
    const settings = useSettingsStore.getState().settings;
    const provider = settings.audioTranscription.provider;
    const modelId = settings.audioTranscription.preferredModelId || "distil-small.en";

    // Route to native sidecar transcription
    try {
      setTranscriptionProgress((prev) => new Map(prev).set(episodeId, { status: "starting", progress: 0 }));
      const autoSegment = settings.documents.autoProcessOnImport;
      const language = settings.audioTranscription.language || 'en';
      await transcribePodcastEpisode(episodeId, modelId, language, autoSegment);
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
      setTranscriptActiveMatchIndex(0);
      setTranscriptTotalMatches(0);
      setTranscriptCopied(false);
    } catch (error) {
      toast.error("Failed to load transcript", error instanceof Error ? error.message : "Unknown error");
    }
  };

  // Find-bar prev/next with wrap-around (mirrors DocumentViewer's handleSearch math).
  const handleTranscriptMatchNav = (direction: "prev" | "next") => {
    setTranscriptActiveMatchIndex((prev) => {
      if (transcriptTotalMatches <= 0) return 0;
      const delta = direction === "next" ? 1 : -1;
      return ((prev + delta) % transcriptTotalMatches + transcriptTotalMatches) % transcriptTotalMatches;
    });
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

  const handleChatAboutThis = async (episode: PodcastEpisode, _feed: PodcastFeed) => {
    try {
      const transcriptText = episode.transcriptText || (await getPodcastTranscript(episode.id)).text;
      if (!transcriptText) {
        toast.error("No transcript available", "Transcribe the episode first");
        return;
      }
      setChattingTranscript({ episode, text: transcriptText });
      setViewingTranscript(null);
    } catch (error) {
      toast.error("Failed to load transcript", error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleDownloadEpisode = async (episode: PodcastEpisode) => {
    if (downloadingEpisodes.has(episode.id)) return;
    setDownloadingEpisodes((prev) => new Set(prev).add(episode.id));
    try {
      const path = await downloadEpisodeAudio(episode.id, episode.audioUrl, episode.audioType ?? undefined);
      setDownloadedEpisodes((prev) => new Map(prev).set(episode.id, path));
    } catch (error) {
      toast.error("Download failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setDownloadingEpisodes((prev) => {
        const next = new Set(prev);
        next.delete(episode.id);
        return next;
      });
    }
  };

  const handleDeleteDownload = async (episodeId: string) => {
    try {
      await deleteDownloadedEpisode(episodeId);
      setDownloadedEpisodes((prev) => {
        const next = new Map(prev);
        next.delete(episodeId);
        return next;
      });
    } catch (error) {
      toast.error("Delete failed", error instanceof Error ? error.message : "Unknown error");
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
      {(!isMobile || !selectedFeedId) && (
        <div className="w-full md:w-80 border-r border-border bg-card flex flex-col flex-shrink-0">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Rss className="w-5 h-5 text-primary" />
                Podcasts
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setShowAddDialog(true);
                    setPodcastSearchQuery("");
                    setPodcastSearchResults([]);
                    setSearchError(null);
                    setShowUrlInput(false);
                  }}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  title="Add podcast"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* MagnifyingGlass */}
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search podcasts..."
                className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Podcast List */}
          <div className="overflow-y-auto flex-1">
            {isLoadingFeeds ? (
              <div className="p-8 flex items-center justify-center">
                <CircleNotch className="w-6 h-6 animate-spin text-muted-foreground" />
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
                {(() => {
                  const filteredFeeds = podcastFeedSearch(searchQuery, feeds);

                  if (filteredFeeds.length === 0 && searchQuery.trim()) {
                    return (
                      <div className="p-8 text-center text-muted-foreground">
                        <MagnifyingGlass className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No podcasts found for "{searchQuery}"</p>
                      </div>
                    );
                  }

                  return filteredFeeds.map((feed) => (
                    <button
                      key={feed.id}
                      onClick={() => setSelectedFeedId(feed.id)}
                      onContextMenu={(e) => handleFeedContextMenu(e, feed)}
                      className={`w-full p-3 text-left hover:bg-muted transition-all duration-200 border-b border-border/40 group relative overflow-hidden ${
                        selectedFeedId === feed.id ? "bg-muted/55 font-medium border-l-4 border-l-primary" : "border-l-4 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-3 font-normal">
                        {/* Cover art */}
                        {feed.imageUrl ? (
                          <img
                            src={feed.imageUrl}
                            alt={feed.title}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0 shadow-md border border-white/5 transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border/45 transition-transform duration-300 group-hover:scale-105">
                            <Rss className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                            {feed.title}
                            {refreshErrors[feed.id] && (
                              <span title={`Refresh failed: ${refreshErrors[feed.id]}`}>
                                <WarningCircle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
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
                  ));
                })()}
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
      )}

      {/* Main Content - Episodes */}
      {(!isMobile || (selectedFeedId && !playingEpisode)) && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {selectedFeed ? (
            <>
              {/* Feed Header */}
              <div className="relative overflow-hidden p-4 sm:p-8 border-b border-border bg-card/70 backdrop-blur-md transition-all duration-500">
                {/* Dynamic Cover Art Backdrop Glow */}
                {selectedFeed.imageUrl && (
                  <div
                    className="absolute inset-0 -z-10 bg-cover bg-center scale-110 blur-3xl opacity-[0.14] dark:opacity-[0.22] transition-all duration-700 select-none pointer-events-none"
                    style={{ backgroundImage: `url(${selectedFeed.imageUrl})` }}
                  />
                )}
                <div className="flex flex-col gap-4 relative z-10">
                  {isMobile && (
                    <button
                      type="button"
                      onClick={() => setSelectedFeedId(null)}
                      className="self-start p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg bg-background/50 hover:bg-background/80 transition-colors flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                      title="Back to podcasts"
                    >
                      <CaretLeft className="w-4 h-4" />
                      <span>Back to Podcasts</span>
                    </button>
                  )}

                  <div className="flex items-start gap-4 sm:gap-6">
                    {selectedFeed.imageUrl ? (
                      <div className="relative group flex-shrink-0 select-none">
                        <div
                          className="absolute inset-0 rounded-2xl bg-cover bg-center blur-md opacity-50 scale-95 translate-y-1.5 transition-all duration-300 group-hover:scale-100 group-hover:translate-y-2.5 group-hover:blur-lg"
                          style={{ backgroundImage: `url(${selectedFeed.imageUrl})` }}
                        />
                        <img
                          src={selectedFeed.imageUrl}
                          alt={selectedFeed.title}
                          className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-2xl object-cover border border-white/10 dark:border-white/5 shadow-xl transition-transform duration-300 group-hover:-translate-y-0.5"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0 border border-border shadow-inner">
                        <Rss className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl sm:text-3xl font-extrabold text-foreground mb-1 tracking-tight truncate">
                        {selectedFeed.title}
                      </h2>
                      {selectedFeed.author && (
                        <p className="text-xs font-semibold text-primary/95 tracking-wide uppercase">
                          {selectedFeed.author}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="w-full">
                    <div 
                      className="text-sm text-muted-foreground line-clamp-2 mb-4 prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline font-normal leading-relaxed" 
                      dangerouslySetInnerHTML={{ __html: _sanitizeHtml(selectedFeed.description || "") }} 
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleRefreshFeed(selectedFeed)}
                        disabled={isRefreshing === selectedFeed.id}
                        className={cn(
                          "px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shadow-sm",
                          refreshErrors[selectedFeed.id]
                            ? "bg-yellow-500/10 text-yellow-600 border border-yellow-500/30"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        )}
                      >
                        {isRefreshing === selectedFeed.id ? (
                          <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowsClockwise className="w-3.5 h-3.5" />
                        )}
                        {refreshErrors[selectedFeed.id] ? "Retry" : "Refresh"}
                      </button>
                      <button
                        onClick={() => {
                          setRenamingFeed(selectedFeed);
                          setRenameTitle(selectedFeed.title);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg flex items-center gap-1.5 shadow-sm transition-all duration-200"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Rename
                      </button>
                      <button
                        onClick={() => handleRemoveSubscription(selectedFeed.id)}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/10 rounded-lg flex items-center gap-1.5 transition-all duration-200"
                      >
                        <Trash className="w-3.5 h-3.5" />
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
                  <CircleNotch className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Funnel & Sort */}
                  <div className="flex items-center gap-2 mb-4">
                    <Funnel className="w-4 h-4 text-muted-foreground" />
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as "all" | "unplayed" | "inprogress")}
                      className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="all">All Episodes</option>
                      <option value="unplayed">Unplayed</option>
                      <option value="inprogress">In Progress</option>
                    </select>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest" | "duration" | "title")}
                      className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="duration">Longest First</option>
                      <option value="title">By Title</option>
                    </select>
                    <span className="text-sm text-muted-foreground">
                      {getFilteredEpisodes().length} episodes
                    </span>
                    <div className="ml-auto relative">
                      <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={episodeSearch}
                        onChange={(e) => setEpisodeSearch(e.target.value)}
                        placeholder="Search episodes..."
                        className="pl-8 pr-7 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-48"
                      />
                      {episodeSearch && (
                        <button
                          onClick={() => setEpisodeSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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

                          {/* Download button */}
                          {(() => {
                            const isDownloaded = downloadedEpisodes.has(episode.id);
                            const isDownloading = downloadingEpisodes.has(episode.id);
                            const progress = downloadProgress.get(episode.id);
                            if (isDownloading) {
                              return (
                                <div className="flex-shrink-0 w-10 h-10 border border-primary/30 rounded-full flex items-center justify-center relative">
                                  <CircleNotch className="w-4 h-4 text-primary animate-spin" />
                                  {progress !== undefined && (
                                    <span className="absolute -bottom-0.5 text-[8px] text-primary font-medium">{progress}%</span>
                                  )}
                                </div>
                              );
                            }
                            if (isDownloaded) {
                              return (
                                <button
                                  onClick={() => handleDeleteDownload(episode.id)}
                                  className="flex-shrink-0 w-10 h-10 bg-green-500/10 text-green-600 rounded-full hover:bg-green-500/20 transition-colors flex items-center justify-center"
                                  title="Downloaded — click to delete"
                                >
                                  <HardDrive className="w-4 h-4" />
                                </button>
                              );
                            }
                            return (
                              <button
                                onClick={() => handleDownloadEpisode(episode)}
                                className="flex-shrink-0 w-10 h-10 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors flex items-center justify-center"
                                title="Download episode"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            );
                          })()}

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
                              return (
                                <div className="flex items-center gap-2">
                                  <div className="flex-shrink-0 w-10 h-10 border border-primary/30 rounded-full flex items-center justify-center">
                                    <CircleNotch className="w-4 h-4 text-primary animate-spin" />
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
                                    <TextT className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleChatAboutThis(episode, selectedFeed)}
                                    className="flex-shrink-0 w-10 h-10 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors flex items-center justify-center"
                                    title="Chat About This"
                                  >
                                    <ChatCircle className="w-5 h-5" />
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
                                  <WarningCircle className="w-5 h-5" />
                                </button>
                              );
                            }
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
                              <div
                                className="text-xs text-muted-foreground line-clamp-2 mb-2 prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline"
                                dangerouslySetInnerHTML={{ __html: _sanitizeHtml(episode.description) }}
                              />
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
                              {episode.playbackPosition > 0 && (episode.duration || 0) > 0 && !episode.played && (
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
                                if (episode.transcriptStatus === "done") {
                                  return (
                                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                      <TextT className="w-3 h-3" />
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
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}

                    {getFilteredEpisodes().length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <MagnifyingGlass className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>{episodeSearch.trim()
                          ? `No episodes match "${episodeSearch}"`
                          : "No episodes match the current filter"}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
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
      )}

      {/* Inline podcast player */}
      {playingEpisode && (
        <div
          className={cn(
            "border-l border-border bg-card flex-shrink-0 flex flex-col overflow-hidden relative",
            isMobile ? "fixed inset-0 z-[70] w-full" : ""
          )}
          style={isMobile ? {} : { width: playerWidth }}
        >
          {/* Drag handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 z-10"
            onMouseDown={(e) => {
              e.preventDefault();
              startPlayerResize();
            }}
          />
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
              filePath: downloadedEpisodes.get(playingEpisode.episode.id) || "",
              fileType: "audio",
              content: "",
              coverImageUrl: playingEpisode.episode.imageUrl || playingEpisode.feed.imageUrl,
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
            autoPlayOnOpen={true}
            initialSeekTime={playerInitialSeekTime}
          />
          </div>
        </div>
      )}

      {/* Add Podcast Dialog (unified search) */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[85vh] mx-4 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Add Podcast</h2>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewFeedUrl("");
                  if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                }}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MagnifyingGlass input */}
            <div className="relative mb-3">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={podcastSearchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search for podcasts..."
                className="w-full pl-9 pr-8 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              {isSearching && (
                <CircleNotch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
              {!isSearching && podcastSearchQuery && (
                <button
                  onClick={() => handleSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* MagnifyingGlass results */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {searchError && (
                <div className="p-4 text-center">
                  <WarningCircle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                  <p className="text-sm text-muted-foreground">{searchError}</p>
                  <button
                    onClick={() => handleSearchChange(podcastSearchQuery)}
                    className="mt-2 text-sm text-primary hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!searchError && podcastSearchQuery.trim().length >= 2 && !isSearching && podcastSearchResults.length === 0 && (
                <div className="p-6 text-center text-muted-foreground">
                  <MagnifyingGlass className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No podcasts found for "{podcastSearchQuery}"</p>
                  <p className="text-xs mt-1">Try different keywords</p>
                </div>
              )}

              {!searchError && podcastSearchResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {podcastSearchResults.map((result) => {
                    const isSubscribed = feeds.some((f) => f.feedUrl === result.url);
                    return (
                      <div
                        key={result.url}
                        className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors flex gap-3"
                      >
                        {/* Cover art */}
                        {result.imageUrl ? (
                          <img
                            src={result.imageUrl}
                            alt={result.title}
                            className="w-16 h-16 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <Rss className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground text-sm truncate">
                            {result.title}
                          </h3>
                          {result.author && (
                            <p className="text-xs text-muted-foreground truncate">{result.author}</p>
                          )}
                          {result.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {result.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            {result.episodeCount != null && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {result.episodeCount} episodes
                              </span>
                            )}
                            <button
                              onClick={() => handleSubscribeFromSearch(result)}
                              disabled={isSubscribed}
                              className={cn(
                                "px-2.5 py-1 text-xs rounded font-medium transition-colors",
                                isSubscribed
                                  ? "bg-muted text-muted-foreground cursor-default"
                                  : "bg-primary text-primary-foreground hover:opacity-90"
                              )}
                            >
                              {isSubscribed ? "Subscribed" : "Subscribe"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state / hint when no query */}
              {!searchError && podcastSearchQuery.trim().length < 2 && (
                <div className="p-6 text-center text-muted-foreground">
                  <MagnifyingGlass className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">MagnifyingGlass for any podcast by name</p>
                </div>
              )}
            </div>

            {/* URL fallback */}
            <div className="mt-3 pt-3 border-t border-border">
              {showUrlInput ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Paste RSS feed URL:</span>
                    <button
                      onClick={() => setShowUrlInput(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newFeedUrl}
                      onChange={(e) => setNewFeedUrl(e.target.value)}
                      placeholder="https://example.com/podcast/feed.xml"
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddSubscription();
                      }}
                    />
                    <button
                      onClick={handleAddSubscription}
                      disabled={isAdding || !newFeedUrl}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1 text-sm"
                    >
                      {isAdding ? (
                        <CircleNotch className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowUrlInput(true)}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Link className="w-3.5 h-3.5" />
                  Paste a feed URL manually
                </button>
              )}
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
                <ChatCircle className="w-3 h-3" />
                Chat About This
              </button>
              {/* Find bar */}
              <div className="flex-1" />
              <div className="flex items-center gap-1">
                <div className="relative">
                  <MagnifyingGlass className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <input
                    type="text"
                    value={transcriptSearchQuery}
                    onChange={(e) => {
                      setTranscriptSearchQuery(e.target.value);
                      setTranscriptActiveMatchIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleTranscriptMatchNav(e.shiftKey ? "prev" : "next");
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setTranscriptSearchQuery("");
                      }
                    }}
                    placeholder={t("viewer.searchTranscript")}
                    className="pl-7 pr-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-44"
                  />
                </div>
                {transcriptSearchQuery.trim() && (
                  <>
                    <span className="text-xs text-muted-foreground px-1 tabular-nums whitespace-nowrap">
                      {transcriptTotalMatches > 0
                        ? t("viewer.searchMatches", {
                            current: transcriptActiveMatchIndex + 1,
                            total: transcriptTotalMatches,
                          })
                        : t("viewer.searchNoMatches")}
                    </span>
                    <button
                      onClick={() => handleTranscriptMatchNav("prev")}
                      disabled={transcriptTotalMatches <= 0}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors disabled:opacity-40 disabled:cursor-default"
                      title="Previous match"
                    >
                      <CaretLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleTranscriptMatchNav("next")}
                      disabled={transcriptTotalMatches <= 0}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors disabled:opacity-40 disabled:cursor-default"
                      title="Next match"
                    >
                      <CaretRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Transcript content — powered by the shared TranscriptSync component
                (same one YouTube/local-video use), in controlled-search mode so the
                find bar above owns the query + active match. */}
            <div className="flex-1 min-h-0">
              <TranscriptSync
                segments={splitTranscriptIntoSegments(
                  viewingTranscript.transcript.text,
                  viewingTranscript.episode.duration ?? undefined,
                )}
                currentTime={-1}
                showHeader={false}
                showTimestamps={false}
                showSpeakers={false}
                autoScroll={false}
                className="h-full border-0 rounded-none"
                searchQuery={transcriptSearchQuery}
                activeMatchIndex={transcriptActiveMatchIndex}
                highlightQuery={transcriptSearchQuery}
                onSearchStateChange={(state: TranscriptSearchState) => {
                  setTranscriptTotalMatches(state.totalMatches);
                  // Clamp our active index if the match set has shrunk below it
                  // (e.g. the user kept typing). Otherwise leave prev/next clicks
                  // in control.
                  setTranscriptActiveMatchIndex((prev) =>
                    state.totalMatches > 0
                      ? Math.min(prev, state.totalMatches - 1)
                      : 0,
                  );
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Inline Chat Panel */}
      {chattingTranscript && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setChattingTranscript(null)}
          />
          <div className="relative w-full max-w-[500px] bg-card border-l border-border flex flex-col shadow-lg">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {chattingTranscript.episode.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Chat with transcript
                </p>
              </div>
              <button
                onClick={() => setChattingTranscript(null)}
                className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Assistant Panel */}
            <div className="flex-1 min-h-0">
              <AssistantPanel
                context={{
                  type: "document",
                  content: chattingTranscript.text,
                  status: "ready",
                  source: "document",
                  metadata: {
                    title: chattingTranscript.episode.title,
                  },
                  resolveForPrompt: async (_prompt: string): Promise<ResolvedAssistantContext> => {
                    return resolveGenericAssistantContext(chattingTranscript.text, "document");
                  },
                }}
                className="h-full border-0"
              />
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

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={confirmDialog.close}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel || (confirmDialog.variant === "danger" ? "Unsubscribe" : "Confirm")}
        itemName={confirmDialog.itemName}
      />
    </div>
  );
}
