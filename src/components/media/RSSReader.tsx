import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Rss,
  Plus,
  Search,
  Star,
  StarOff,
  ExternalLink,
  RefreshCw,
  Settings,
  Trash2,
  CheckCircle2,
  Folder,
  Import,
  Download,
  Newspaper,
  X,
  Scroll,
  ArrowLeft,
  Link2,
  FileText,
  MoreVertical,
  Globe,
  EyeOff,
  GripVertical,
  Brain,
  GraduationCap,
  Tag,
  Keyboard,
} from "lucide-react";
import {
  Feed,
  FeedItem,
  getSubscribedFeeds,
  getSubscribedFeedsAuto,
  fetchFeed,
  subscribeToFeed,
  subscribeToFeedAuto,
  unsubscribeFromFeedAuto,
  markItemReadAuto,
  markFeedReadAuto,
  toggleItemFavoriteAuto,
  getFeedFolders,
  importOpmlAuto,
  exportOpmlAuto,
  syncFeedToTauri,
  formatFeedDate,
  setRssPreferencesAuto,
  getRssPreferencesAuto,
  fetchArticleFullContent,
  generateArticleExcerpt,
  type RssUserPreference,
  cleanupOldRssArticlesAuto,
} from "../../api/rss";
import { useSettingsStore } from "../../stores/settingsStore";
import { RSSCustomizationPanel, RSSUserPreferenceUpdate } from "./RSSCustomizationPanel";
import { NewsletterDirectory } from "../newsletter/NewsletterDirectory";
import { NewsletterUrlImporter } from "../newsletter/NewsletterUrlImporter";
import { RSSScrollMode } from "./RSSScrollMode";
import { RSSFullContentView } from "./RSSFullContentView";
import { FeedSettingsDialog } from "./FeedSettingsDialog";
import { MagazineLayout, GridLayout } from "./ArticleLayouts";
import { useI18n } from "../../lib/i18n";
import { isTauri, openExternal } from "../../lib/tauri";
import { sanitizeHtml } from "../common/RichContentRenderer";
import { getDeviceInfo } from "../../lib/pwa";
import { IntelligenceIndicator } from "./IntelligenceIndicator";
import { TrainingMenu } from "./TrainingMenu";
import { KeyboardShortcutProvider } from "./KeyboardShortcutProvider";
import { KeyboardHelpOverlay } from "./KeyboardHelpOverlay";
import { SearchResults } from "./SearchResults";
import { OriginalView } from "./OriginalView";
import { StoryView } from "./StoryView";
import { StoryViewModeSwitcher, type StoryViewMode } from "./StoryViewModeSwitcher";
import { ManageTrainingView } from "./ManageTrainingView";
import { DiscoverSitesPanel } from "./DiscoverSitesPanel";
import { TagInput } from "./TagInput";
import { searchArticlesAuto, type RssSearchResult } from "../../api/rss-search";
import { markArticleUnreadAuto, migrateFoldersFromLocalStorageAuto } from "../../api/rss-folders";
import { useClassifiersStore } from "../../stores/classifiersStore";
import { useTagsStore } from "../../stores/tagsStore";
import { useCollectionStore } from "../../stores/collectionStore";

type ViewMode = "all" | "unread" | "favorites" | "search";

// Default auto-refresh interval in milliseconds (5 minutes)
const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function RSSReader() {
  const { t } = useI18n();
  const { settings } = useSettingsStore();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null);
  const [items, setItems] = useState<Array<{ feed: Feed; item: FeedItem }>>([]);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [selectedItemFeed, setSelectedItemFeed] = useState<Feed | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [lastNonSearchViewMode, setLastNonSearchViewMode] = useState<ViewMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [showNewsletterDirectory, setShowNewsletterDirectory] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [folders, setFolders] = useState(getFeedFolders());
  const [preferences, setPreferences] = useState<RssUserPreference | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [lastAutoRefresh, setLastAutoRefresh] = useState<Date | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<"idle" | "syncing" | "success" | "error">(
    "idle"
  );
  const [scrollMode, setScrollMode] = useState(false);
  const [mobileView, setMobileView] = useState<"feeds" | "items" | "reader">("items");
  const [showFeedSettings, setShowFeedSettings] = useState(false);
  const [feedSettingsFeed, setFeedSettingsFeed] = useState<Feed | null>(null);
  const [showFullContent, setShowFullContent] = useState(false);

  // NewsBlur features state
  const [storyViewMode, setStoryViewMode] = useState<StoryViewMode>("feed");
  const [articleLayout, setArticleLayout] = useState<"list" | "magazine" | "grid">("list");
  const [showTrainingMenu, setShowTrainingMenu] = useState(false);
  const [trainingMenuPosition, setTrainingMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showManageTraining, setShowManageTraining] = useState(false);
  const [showDiscoverSites, setShowDiscoverSites] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [searchResults, setSearchResults] = useState<RssSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [_showReadStories, setShowReadStories] = useState(false);
  const [draggedFeedId, setDraggedFeedId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [draggedFeedTitle, setDraggedFeedTitle] = useState<string | null>(null);
  const { intelligenceFilter, showDisliked, setIntelligenceFilter, toggleShowDisliked } = useClassifiersStore();
  const { tags, loadTags, loadArticleTags, articleTags, setTagFilter, selectedTagFilter } = useTagsStore();
  const [showTagInput, setShowTagInput] = useState(false);
  const [selectedArticleTags, setSelectedArticleTags] = useState<import("../../api/rss-tags").RssTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  const deviceInfo = getDeviceInfo();
  const isMobile = deviceInfo.isMobile || deviceInfo.isTablet;

  // Reference to the auto-refresh interval
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleSyncFeedbackReset = useCallback((delayMs = 3500) => {
    if (syncFeedbackTimeoutRef.current) {
      clearTimeout(syncFeedbackTimeoutRef.current);
      syncFeedbackTimeoutRef.current = null;
    }
    syncFeedbackTimeoutRef.current = setTimeout(() => {
      setSyncFeedback("idle");
      syncFeedbackTimeoutRef.current = null;
    }, delayMs);
  }, []);

  // Apply preferences when saved
  const handleSavePreferences = async (newPreferences: RSSUserPreferenceUpdate) => {
    try {
      const saved = await setRssPreferencesAuto(newPreferences, selectedFeed?.id);
      setPreferences(saved);
      console.log("Preferences saved successfully:", saved);
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  };

  // Load preferences on mount or when feed changes
  useEffect(() => {
    (async () => {
      if (selectedFeed) {
        try {
          const loaded = await getRssPreferencesAuto(selectedFeed.id);
          setPreferences(loaded);
        } catch (error) {
          console.error("Failed to load preferences:", error);
        }
      }
    })();
  }, [selectedFeed]);

  // Load feeds on mount and when collection changes
  const activeCollectionId = useCollectionStore((s) => s.activeCollectionId);
  useEffect(() => {
    (async () => {
      await loadFeeds();
    })();
  }, [activeCollectionId]);

  // Update items when feeds or view mode changes
  useEffect(() => {
    const allFeedItems = feeds.flatMap((feed) => feed.items.map((item) => ({ feed, item })));

    // Intelligence filter: hide disliked articles (negative score) unless showDisliked is on
    const applyIntelligenceFilter = (list: Array<{ feed: Feed; item: FeedItem }>) => {
      if (showDisliked) return list;
      return list.filter(({ item }) => {
        const score = item.intelligenceScore;
        if (score == null) return true; // unscored articles pass through
        return score >= 0;
      });
    };

    if (viewMode === "all" && selectedFeed) {
      let items = selectedFeed.items.map((item) => ({ feed: selectedFeed, item }));
      if (intelligenceFilter === "focus") {
        items = items.filter(({ item }) => (item.intelligenceScore ?? 0) > 0);
      }
      setItems(applyIntelligenceFilter(items));
    } else if (viewMode === "unread") {
      let filtered = allFeedItems.filter(({ item }) => !item.read);
      if (intelligenceFilter === "focus") {
        filtered = filtered.filter(({ item }) => (item.intelligenceScore ?? 0) > 0);
      }
      setItems(
        applyIntelligenceFilter(filtered)
          .sort((a, b) => new Date(b.item.pubDate).getTime() - new Date(a.item.pubDate).getTime())
      );
    } else if (viewMode === "favorites") {
      const filtered = allFeedItems.filter(({ item }) => item.favorite);
      // Multi-tag AND filtering
      if (selectedTagIds.size > 0) {
        const tagArr = Array.from(selectedTagIds);
        const tagged = filtered.filter(({ item }) => {
          const at = articleTags.get(item.id) || [];
          return tagArr.every((tid) => at.some((t) => t.id === tid));
        });
        setItems(tagged.sort((a, b) => new Date(b.item.pubDate).getTime() - new Date(a.item.pubDate).getTime()));
      } else {
        setItems(filtered.sort((a, b) => new Date(b.item.pubDate).getTime() - new Date(a.item.pubDate).getTime()));
      }
    } else if (viewMode === "search" && searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      setItems(
        allFeedItems
          .filter(
            ({ item }) =>
              item.title.toLowerCase().includes(lowerQuery) ||
              item.description.toLowerCase().includes(lowerQuery) ||
              item.content.toLowerCase().includes(lowerQuery)
          )
          .sort((a, b) => new Date(b.item.pubDate).getTime() - new Date(a.item.pubDate).getTime())
      );
    } else {
      setItems([]);
    }
  }, [viewMode, selectedFeed, feeds, searchQuery, selectedTagFilter, selectedTagIds, articleTags, intelligenceFilter, showDisliked]);

  // Load tags on mount
  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  // Load article tags when selected article changes
  useEffect(() => {
    if (selectedItem) {
      void loadArticleTags(selectedItem.id).then(() => {
        setSelectedArticleTags(articleTags.get(selectedItem.id) || []);
      });
    } else {
      setSelectedArticleTags([]);
    }
  }, [selectedItem, loadArticleTags, articleTags]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedItem(null);
      setSelectedItemFeed(null);
      return;
    }

    if (selectedItem) {
      const stillThere = items.find(({ item }) => item.id === selectedItem.id);
      if (stillThere) {
        setSelectedItem(stillThere.item);
        setSelectedItemFeed(stillThere.feed);
        return;
      }
    }

    setSelectedItem(items[0].item);
    setSelectedItemFeed(items[0].feed);
  }, [items, selectedItem]);

  useEffect(() => {
    if (!isMobile) return;
    if (!selectedFeed) {
      setMobileView("feeds");
      return;
    }
    if (!selectedItem) {
      setMobileView("items");
    }
  }, [isMobile, selectedFeed, selectedItem]);

  const loadFeeds = async () => {
    const feeds = await getSubscribedFeedsAuto();
    setFeeds(feeds);
    setSelectedFeed((prev) => {
      if (!prev) return prev;
      return feeds.find((feed) => feed.id === prev.id || feed.feedUrl === prev.feedUrl) ?? null;
    });
    setFolders(getFeedFolders());

    // Trigger background database article pruning if configured
    const maxAgeDays = settings?.rssQueue?.maxItemAgeDays ?? 2;
    if (maxAgeDays > 0) {
      cleanupOldRssArticlesAuto(maxAgeDays).catch((err) => {
        console.warn("[RSS] Background article cleanup failed:", err);
      });
    }

    // Migrate localStorage folders to SQLite on first launch (one-time)
    try {
      const localStorageFolders = localStorage.getItem("rss_folders");
      if (localStorageFolders) {
        const migrated = await migrateFoldersFromLocalStorageAuto(localStorageFolders);
        if (migrated > 0) {
          console.log(`[RSS] Migrated ${migrated} folders from localStorage to SQLite`);
          localStorage.removeItem("rss_folders");
        }
      }
    } catch (err) {
      console.warn("[RSS] Folder migration failed:", err);
    }
    return feeds;
  };

  const moveFeedToFolderInSidebar = useCallback((feedId: string, folderId?: string) => {
    const nextFolders = getFeedFolders().map((folder) => ({
      ...folder,
      feeds: folder.feeds.filter((existingFeedId) => existingFeedId !== feedId),
    }));

    if (folderId) {
      const target = nextFolders.find((folder) => folder.id === folderId);
      if (target && !target.feeds.includes(feedId)) {
        target.feeds.push(feedId);
      }
    }

    localStorage.setItem("rss_folders", JSON.stringify(nextFolders));
    setFolders(nextFolders);
  }, []);

  // Refresh all feeds (for auto-refresh and manual refresh all)
  const refreshAllFeeds = useCallback(
    async (source: "auto" | "manual" = "manual") => {
      if (isAutoRefreshing) return; // Prevent concurrent refreshes

      setIsAutoRefreshing(true);
      if (source === "manual") {
        setSyncFeedback("syncing");
      }
      console.log("[RSS Auto-Refresh] Starting periodic refresh...");

      try {
        const currentFeeds = await getSubscribedFeedsAuto();
        let hadFeedErrors = false;

        for (const feed of currentFeeds) {
          try {
            const updated = await fetchFeed(feed.feedUrl);
            if (updated) {
              if (isTauri()) {
                const merged = {
                  ...updated,
                  category: feed.category ?? updated.category,
                };
                await syncFeedToTauri(merged, feed.items);
              } else {
                // Preserve read/favorite status from existing items
                const existing = getSubscribedFeeds().find((f) => f.id === feed.id);
                if (existing) {
                  updated.items.forEach((newItem) => {
                    const existingItem = existing.items.find((i) => i.id === newItem.id);
                    if (existingItem) {
                      newItem.read = existingItem.read;
                      newItem.favorite = existingItem.favorite;
                    }
                  });
                }
                subscribeToFeed(updated);

                // Auto-fetch full content for "always" mode feeds in web mode
                if (feed.autoFetchFullContent === "always") {
                  const newItems = updated.items.filter((newItem) => {
                    const existingItem = existing?.items.find((i) => i.id === newItem.id);
                    return !existingItem; // Only new items
                  });
                  if (newItems.length > 0) {
                    console.log(
                      `[RSS] Auto-fetching full content for ${newItems.length} new items in feed "${feed.title}"`
                    );
                    newItems.forEach((item) => {
                      void fetchArticleFullContent(item.id, item.link);
                    });
                  }
                }
              }
            }
          } catch (error) {
            console.warn(`[RSS Auto-Refresh] Failed to refresh feed ${feed.title}:`, error);
            hadFeedErrors = true;
            // Continue with other feeds even if one fails
          }
        }

        // Reload feeds after updating
        await loadFeeds();
        setLastAutoRefresh(new Date());
        if (source === "manual") {
          setSyncFeedback(hadFeedErrors ? "error" : "success");
          scheduleSyncFeedbackReset(hadFeedErrors ? 5000 : 3500);
        }
        console.log("[RSS Auto-Refresh] Completed periodic refresh");
      } catch (error) {
        console.error("[RSS Auto-Refresh] Failed to refresh feeds:", error);
        if (source === "manual") {
          setSyncFeedback("error");
          scheduleSyncFeedbackReset(5000);
        }
      } finally {
        setIsAutoRefreshing(false);
      }
    },
    [isAutoRefreshing, scheduleSyncFeedbackReset]
  );

  // Set up periodic auto-refresh
  useEffect(() => {
    // Start the auto-refresh interval
    autoRefreshIntervalRef.current = setInterval(() => {
      refreshAllFeeds("auto");
    }, DEFAULT_REFRESH_INTERVAL_MS);

    console.log(
      `[RSS Auto-Refresh] Set up periodic refresh every ${DEFAULT_REFRESH_INTERVAL_MS / 1000 / 60} minutes`
    );

    // Cleanup on unmount
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
        console.log("[RSS Auto-Refresh] Cleared periodic refresh interval");
      }
      if (syncFeedbackTimeoutRef.current) {
        clearTimeout(syncFeedbackTimeoutRef.current);
        syncFeedbackTimeoutRef.current = null;
      }
    };
  }, [refreshAllFeeds]);

  const handleAddFeed = async () => {
    if (!newFeedUrl.trim()) return;

    setIsAdding(true);
    try {
      const feed = await fetchFeed(newFeedUrl);
      if (feed) {
        await subscribeToFeedAuto(feed);
        const updatedFeeds = await loadFeeds();
        setSelectedFeed(
          updatedFeeds.find(
            (candidate) => candidate.id === feed.id || candidate.feedUrl === feed.feedUrl
          ) ?? feed
        );
        setShowAddDialog(false);
        setNewFeedUrl("");
      } else {
        alert("Failed to parse feed. Please check the URL.");
      }
    } catch (error) {
      alert("Error adding feed: " + (error as Error).message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRefreshFeed = async (feed: Feed) => {
    try {
      const updated = await fetchFeed(feed.feedUrl);
      if (updated) {
        // Preserve read/favorite status
        updated.items.forEach((newItem) => {
          const existingItem = feed.items.find((i) => i.id === newItem.id);
          if (existingItem) {
            newItem.read = existingItem.read;
            newItem.favorite = existingItem.favorite;
          }
        });

        if (isTauri()) {
          await syncFeedToTauri(updated, feed.items);
        } else {
          await subscribeToFeedAuto(updated);
        }

        await loadFeeds();
      }
    } catch (error) {
      alert("Failed to refresh feed: " + (error as Error).message);
    }
  };

  const handleDiscoverSiteSubscribe = useCallback(async (feed: Feed) => {
    const updatedFeeds = await loadFeeds();
    const subscribedFeed =
      updatedFeeds.find((candidate) => candidate.feedUrl === feed.feedUrl || candidate.link === feed.link) ?? null;

    if (subscribedFeed) {
      setSelectedFeed(subscribedFeed);
      if (isMobile) {
        setMobileView("items");
      }
    }

    setShowDiscoverSites(false);
  }, [isMobile]);

  const handleMoveFeedToSection = useCallback((feedId: string, folderId?: string) => {
    moveFeedToFolderInSidebar(feedId, folderId);
    setDragOverSectionId(null);
    setDraggedFeedId(null);
    setDraggedFeedTitle(null);
  }, [moveFeedToFolderInSidebar]);

  const canDropIntoSection = useCallback((section: { isFolder: boolean; folderId?: string; feeds: Feed[] }) => {
    if (!draggedFeedId || !section.isFolder || !section.folderId) return false;
    return !section.feeds.some((feed) => feed.id === draggedFeedId);
  }, [draggedFeedId]);

  const dragModeActive = draggedFeedId !== null;

  const beginSidebarDrag = useCallback((feed: Feed) => {
    setDraggedFeedId(feed.id);
    setDraggedFeedTitle(feed.title);
    setDragOverSectionId(null);
  }, []);

  const cancelSidebarDrag = useCallback(() => {
    setDraggedFeedId(null);
    setDraggedFeedTitle(null);
    setDragOverSectionId(null);
  }, []);

  useEffect(() => {
    if (!dragModeActive) return;

    const handlePointerUp = () => {
      cancelSidebarDrag();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelSidebarDrag();
      }
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cancelSidebarDrag, dragModeActive]);

  const handleRemoveFeed = async (feedId: string) => {
    if (confirm(t("delete.unsubscribeConfirm"))) {
      await unsubscribeFromFeedAuto(feedId);
      await loadFeeds();
      if (selectedFeed?.id === feedId) {
        setSelectedFeed(null);
      }
    }
  };

  const handleItemClick = async (feed: Feed, item: FeedItem) => {
    await markItemReadAuto(feed.id, item.id, true);
    await loadFeeds();
    setSelectedItem(item);
    setSelectedItemFeed(feed);
    if (isMobile) {
      setMobileView("reader");
    }
  };

  const handleToggleFavorite = async (feed: Feed, item: FeedItem) => {
    await toggleItemFavoriteAuto(feed.id, item.id);
    await loadFeeds();
  };

  const handleMarkAllRead = async (feedId: string) => {
    const msg = t("rssReader.markAllReadConfirm") || "Are you sure you want to mark all articles in this feed as read?";
    if (confirm(msg)) {
      // Mark read in database (background / async)
      await markFeedReadAuto(feedId);
      
      // Instantly dismiss/update the local feeds and items state so the UI updates without delay
      setFeeds((prevFeeds) =>
        prevFeeds.map((f) => {
          if (f.id === feedId) {
            return {
              ...f,
              unreadCount: 0,
              items: f.items.map((item) => ({ ...item, read: true })),
            };
          }
          return f;
        })
      );
      
      // Update items list currently shown in the view
      setItems((prevItems) =>
        prevItems.map((itemObj) => {
          if (itemObj.feed.id === feedId) {
            return {
              ...itemObj,
              item: { ...itemObj.item, read: true },
            };
          }
          return itemObj;
        })
      );

      // Clear selection if it belongs to this feed and is now read and not favorited
      if (selectedItem && selectedItem.feedId === feedId && !selectedItem.favorite) {
        setSelectedItem(null);
      }

      await loadFeeds();
    }
  };

  const handleOpenOriginal = useCallback(async (url?: string) => {
    if (!url) return;
    try {
      await openExternal(url);
    } catch (error) {
      console.error("Failed to open original URL:", error);
    }
  }, []);

  const handleExportOPML = async () => {
    const opml = await exportOpmlAuto();
    const blob = new Blob([opml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feeds.opml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportOPML = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".opml,.xml";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const content = event.target?.result as string;
          const importedFeeds = await importOpmlAuto(content);
          if (importedFeeds.length > 0) {
            if (isTauri()) {
              await Promise.all(
                importedFeeds.map(async (feed) => {
                  try {
                    const updated = await fetchFeed(feed.feedUrl);
                    if (updated) {
                      const merged = {
                        ...updated,
                        category: feed.category ?? updated.category,
                      };
                      await syncFeedToTauri(merged);
                      return;
                    }
                    await syncFeedToTauri(feed);
                  } catch (error) {
                    console.warn("Failed to fetch feed during OPML import:", feed.feedUrl, error);
                    await syncFeedToTauri(feed);
                  }
                })
              );
            } else {
              importedFeeds.forEach((feed) => subscribeToFeed(feed));
            }
          }
          await loadFeeds();
          alert(`Imported ${importedFeeds.length || "feeds"} successfully`);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const unreadCount = feeds.reduce((acc, feed) => acc + feed.unreadCount, 0);
  const groupedFeeds = useMemo(() => {
    const sections: Array<{ id: string; name: string; feeds: Feed[]; isFolder: boolean; folderId?: string }> = [];
    const assigned = new Set<string>();

    folders.forEach((folder) => {
      const folderFeeds = folder.feeds
        .map((feedId) => feeds.find((feed) => feed.id === feedId))
        .filter((feed): feed is Feed => Boolean(feed));
      if (folderFeeds.length > 0) {
        sections.push({ id: folder.id, name: folder.name, feeds: folderFeeds, isFolder: true, folderId: folder.id });
        folderFeeds.forEach((feed) => assigned.add(feed.id));
      }
    });

    const categoryMap = new Map<string, Feed[]>();
    feeds.forEach((feed) => {
      if (assigned.has(feed.id)) {
        return;
      }
      if (feed.category) {
        const list = categoryMap.get(feed.category) ?? [];
        list.push(feed);
        categoryMap.set(feed.category, list);
        assigned.add(feed.id);
      }
    });

    Array.from(categoryMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([category, categoryFeeds]) => {
        sections.push({
          id: `category-${category}`,
          name: category,
          feeds: categoryFeeds,
          isFolder: false,
        });
      });

    const ungrouped = feeds.filter((feed) => !assigned.has(feed.id));

    return { sections, ungrouped };
  }, [feeds, folders]);
  const itemsTitle =
    viewMode === "all" && selectedFeed
      ? selectedFeed.title
      : viewMode === "unread"
        ? t("common.unread")
        : viewMode === "favorites"
          ? t("common.favorites")
          : t("common.search");
  const itemsSubtitle =
    viewMode === "all" && selectedFeed
      ? `${selectedFeed.items.length} ${t("common.items")}`
      : `${items.length} ${t("common.items")}`;
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode !== "search") {
      setLastNonSearchViewMode(mode);
      setSearchQuery("");
    }
  };
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim().length > 0) {
      setViewMode("search");
    } else {
      setViewMode(lastNonSearchViewMode);
    }
  };

  // Enhanced FTS5 search with debounce
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const handleFTSSearch = useCallback((query: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query.trim()) { setSearchResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchArticlesAuto({
          query: query.trim(),
          feed_id: selectedFeed?.id,
        });
        setSearchResults(results);
      } catch (err) {
        console.error("[RSS] FTS search failed:", err);
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);
  }, [selectedFeed?.id]);

  useEffect(() => {
    if (viewMode === "search" && searchQuery) {
      handleFTSSearch(searchQuery);
    }
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, viewMode, handleFTSSearch]);

  // Keyboard shortcut action handler
  const handleKeyboardAction = useCallback((action: string) => {
    const currentItems = items;
    const currentIndex = currentItems.findIndex(
      (i) => i.item.id === selectedItem?.id
    );

    switch (action) {
      case "nextArticle":
        if (currentIndex < currentItems.length - 1) {
          const next = currentItems[currentIndex + 1];
          setSelectedItem(next.item);
          setSelectedItemFeed(next.feed);
          if (!next.item.read) {
            void markItemReadAuto(next.feed.id, next.item.id, true);
          }
        }
        break;
      case "prevArticle":
        if (currentIndex > 0) {
          const prev = currentItems[currentIndex - 1];
          setSelectedItem(prev.item);
          setSelectedItemFeed(prev.feed);
        }
        break;
      case "markRead":
        if (selectedItem && selectedItemFeed) {
          void markItemReadAuto(selectedItemFeed.id, selectedItem.id, true);
        }
        break;
      case "markUnread":
        if (selectedItem) {
          void markArticleUnreadAuto(selectedItem.id);
        }
        break;
      case "star":
        if (selectedItem && selectedItemFeed) {
          handleToggleFavorite(selectedItemFeed, selectedItem);
        }
        break;
      case "openOriginal":
        if (selectedItem?.link) {
          void openExternal(selectedItem.link);
        }
        break;
      case "focusSearch":
        document.querySelector<HTMLInputElement>('input[placeholder*="earch"]')?.focus();
        break;
      case "showHelp":
        setShowKeyboardHelp(true);
        break;
      case "nextViewMode":
        setStoryViewMode((prev) => {
          const modes: StoryViewMode[] = ["feed", "original", "text", "story"];
          const idx = modes.indexOf(prev);
          return modes[(idx + 1) % modes.length];
        });
        break;
      case "textView":
        setStoryViewMode("text");
        break;
      case "refreshFeed":
        if (selectedFeed) void refreshAllFeeds("manual");
        break;
      case "trainLike":
        if (selectedItem && selectedItemFeed) {
          setShowTrainingMenu(true);
          setTrainingMenuPosition({ x: window.innerWidth - 200, y: 100 });
        }
        break;
    }
  }, [items, selectedItem, selectedItemFeed, selectedFeed, handleToggleFavorite, refreshAllFeeds]);

  // Mark article unread handler
  const handleMarkUnread = async (feed: Feed, item: FeedItem) => {
    try {
      await markItemReadAuto(feed.id, item.id, false);
    } catch (err) {
      console.error("[RSS] Failed to mark unread:", err);
    }
  };

  const readingStyles = useMemo(() => {
    if (!preferences) return {};
    return {
      "--reading-font-family": preferences.font_family,
      "--reading-font-size": preferences.font_size ? `${preferences.font_size}px` : undefined,
      "--reading-line-height": preferences.line_height,
      "--reading-max-width": preferences.content_width
        ? `${preferences.content_width}ch`
        : undefined,
      "--reading-text-align": preferences.text_align,
    } as React.CSSProperties;
  }, [preferences]);

  // Scroll mode view - render before main layout
  if (scrollMode) {
    return <RSSScrollMode onExit={() => setScrollMode(false)} initialFeedId={selectedFeed?.id} />;
  }

  const showSidebar = !isMobile || mobileView === "feeds";
  const showItemsList = !isMobile || mobileView === "items";
  const showReader = !isMobile || mobileView === "reader";

  return (
    <>
      <KeyboardShortcutProvider onAction={handleKeyboardAction} />
      <KeyboardHelpOverlay isOpen={showKeyboardHelp} onClose={() => setShowKeyboardHelp(false)} />
      {showManageTraining && (
        <div className="fixed inset-0 z-50 bg-background">
          <ManageTrainingView onClose={() => setShowManageTraining(false)} />
        </div>
      )}
      {showDiscoverSites && (
        <div className="fixed inset-0 z-50 bg-background">
          <DiscoverSitesPanel
            onClose={() => setShowDiscoverSites(false)}
            onSubscribe={(feed) => void handleDiscoverSiteSubscribe(feed)}
          />
        </div>
      )}
      {showTrainingMenu && selectedItem && selectedItemFeed && (
        <TrainingMenu
          article={selectedItem}
          feedId={selectedItemFeed.id}
          position={trainingMenuPosition}
          onClose={() => setShowTrainingMenu(false)}
        />
      )}
      <div className="h-full w-full bg-background">
        {isMobile && (
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/70">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Rss className="w-4 h-4 text-orange-500" />
                {t("rssReader.title")}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowAddDialog(true)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-lg mobile-density-tap"
                  title={t("common.addFeed")}
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => refreshAllFeeds("manual")}
                  disabled={isAutoRefreshing}
                  className={`p-2 rounded-lg mobile-density-tap disabled:opacity-50 disabled:cursor-not-allowed ${
                    syncFeedback === "error"
                      ? "text-red-600 dark:text-red-400 hover:bg-red-500/10"
                      : syncFeedback === "success"
                        ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                        : "text-green-600 dark:text-green-400 hover:bg-green-500/10"
                  }`}
                  title={
                    syncFeedback === "error"
                      ? t("rssReader.syncErrors")
                      : syncFeedback === "success"
                        ? t("rssReader.syncCompleted")
                        : t("rssReader.syncAllFeeds")
                  }
                >
                  {isAutoRefreshing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : syncFeedback === "success" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : syncFeedback === "error" ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setScrollMode(true)}
                  className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 rounded-lg mobile-density-tap"
                  title={t("rssReader.scrollMode")}
                >
                  <Scroll className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="px-4 pb-3">
              <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-muted/60">
                <button
                  onClick={() => setMobileView("feeds")}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    mobileView === "feeds"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {t("rssReader.feeds")}
                </button>
                <button
                  onClick={() => setMobileView("items")}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    mobileView === "items"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {t("rssReader.articles")}
                </button>
                <button
                  onClick={() => selectedItem && setMobileView("reader")}
                  disabled={!selectedItem}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    mobileView === "reader"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  } ${!selectedItem ? "opacity-50" : ""}`}
                >
                  {t("rssReader.reader")}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="h-full w-full flex flex-col lg:flex-row overflow-hidden rounded-xl border border-border/70 bg-card/60 shadow-[0_0_0_1px_rgba(15,23,42,0.04)]">
          {/* Sidebar */}
          <div
            className={`w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-border/70 bg-card/60 flex-col min-h-0 ${showSidebar ? "flex" : "hidden"}`}
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-border/70 bg-gradient-to-b from-muted/30 via-muted/10 to-transparent">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 tracking-tight">
                  <Rss className="w-5 h-5 text-orange-500" />
                  RSS
                </h2>
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowAddDialog(true)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded transition-colors"
                    title={t("common.addFeed")}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowUrlImport(true)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                    title={t("rssReader.importByUrl")}
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowNewsletterDirectory(true)}
                    className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"
                    title={t("rssReader.browseDirectory")}
                  >
                    <Newspaper className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setScrollMode(true)}
                    className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"
                    title={t("rssReader.scrollMode")}
                  >
                    <Scroll className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => refreshAllFeeds("manual")}
                    disabled={isAutoRefreshing}
                    className={`p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      syncFeedback === "error"
                        ? "text-red-600 dark:text-red-400 hover:bg-red-500/10"
                        : syncFeedback === "success"
                          ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                          : "text-green-600 dark:text-green-400 hover:bg-green-500/10"
                    }`}
                    title={
                      syncFeedback === "error"
                        ? t("rssReader.syncErrors")
                        : syncFeedback === "success"
                          ? t("rssReader.syncCompleted")
                          : t("rssReader.syncAllFeeds")
                    }
                  >
                    {isAutoRefreshing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : syncFeedback === "success" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : syncFeedback === "error" ? (
                      <X className="w-4 h-4" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </button>
                  <div className="relative group">
                    <button
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded transition-colors"
                      title={t("rssReader.moreOptions")}
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                      <button
                        onClick={handleImportOPML}
                        className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 first:rounded-t-lg flex items-center gap-2"
                      >
                        <Import className="w-4 h-4" />
                        {t("rssReader.importOpml")}
                      </button>
                      <button
                        onClick={handleExportOPML}
                        className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        {t("rssReader.exportOpml")}
                      </button>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => setShowManageTraining(true)}
                        className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-2"
                      >
                        <GraduationCap className="w-4 h-4" />
                        Manage Training
                      </button>
                      <button
                        onClick={() => setShowDiscoverSites(true)}
                        className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-2"
                      >
                        <Globe className="w-4 h-4" />
                        Discover Sites
                      </button>
                      <button
                        onClick={() => setShowKeyboardHelp(true)}
                        className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-2"
                      >
                        <Keyboard className="w-4 h-4" />
                        Keyboard Shortcuts
                      </button>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => setShowCustomization(true)}
                        className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 last:rounded-b-lg flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        {t("rssReader.customize")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {(syncFeedback !== "idle" || lastAutoRefresh) && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {isAutoRefreshing || syncFeedback === "syncing"
                    ? t("rssReader.syncing")
                    : syncFeedback === "success"
                      ? t("rssReader.syncCompleted")
                      : syncFeedback === "error"
                        ? t("rssReader.syncFinishedErrors")
                        : t("rssReader.syncIdle")}{" "}
                  {lastAutoRefresh
                    ? `· Last sync ${lastAutoRefresh.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                    : ""}
                </div>
              )}

              {/* View mode tabs */}
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => handleViewModeChange("all")}
                  className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                    viewMode === "all"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {t("rssReader.all")}
                </button>
                <button
                  onClick={() => handleViewModeChange("unread")}
                  className={`px-2 py-1.5 text-xs rounded-md transition-colors relative ${
                    viewMode === "unread"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {t("rssReader.unread")}
                  {unreadCount > 0 && (
                    <span className="ml-1 px-1 bg-red-500 text-white text-[10px] rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleViewModeChange("favorites")}
                  className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                    viewMode === "favorites"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {t("rssReader.favorites")}
                </button>
                <button
                  onClick={() => setShowReadStories(true)}
                  className="px-2 py-1.5 text-xs rounded-md transition-colors bg-primary text-primary-foreground shadow-sm"
                >
                  Read
                </button>
              </div>

              {/* Intelligence filter controls */}
              <div className="flex items-center gap-1 mt-2">
                <button
                  onClick={() => setIntelligenceFilter(intelligenceFilter === "focus" ? "all" : "focus")}
                  className={`px-2 py-1 text-[10px] rounded-md transition-colors flex items-center gap-1 ${
                    intelligenceFilter === "focus"
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground hover:bg-muted/70"
                  }`}
                  title="Focus mode: show liked stories"
                >
                  <Brain className="w-3 h-3" />
                  Focus
                </button>
                <button
                  onClick={toggleShowDisliked}
                  className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                    showDisliked
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      : "text-muted-foreground hover:bg-muted/70"
                  }`}
                  title="Show/hide disliked stories"
                >
                  <EyeOff className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Feed list */}
            <div className="flex-1 overflow-y-auto">
              {feeds.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Rss className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="mb-2">{t("rssReader.noFeeds")}</p>
                  <button
                    onClick={() => setShowAddDialog(true)}
                    className="text-orange-500 hover:underline text-sm"
                  >
                    {t("rssReader.addFirstFeed")}
                  </button>
                </div>
              ) : (
                <div>
                  {dragModeActive && draggedFeedTitle && (
                    <div className="px-3 py-2 border-b border-primary/20 bg-primary/10 text-primary">
                      <p className="text-xs font-medium">Moving {draggedFeedTitle}</p>
                      <p className="text-[11px] opacity-80">Release over a folder section to move it there. Press Esc to cancel.</p>
                    </div>
                  )}
                  {groupedFeeds.sections.map((section) => (
                    <div
                      key={section.id}
                      onPointerEnter={() => {
                        if (!canDropIntoSection(section)) return;
                        setDragOverSectionId(section.id);
                      }}
                      onPointerLeave={(e) => {
                        const nextTarget = e.relatedTarget;
                        if (nextTarget instanceof Node && e.currentTarget.contains(nextTarget)) return;
                        if (dragOverSectionId === section.id) {
                          setDragOverSectionId(null);
                        }
                      }}
                      onPointerUp={() => {
                        if (!canDropIntoSection(section) || !draggedFeedId || !section.folderId) return;
                        handleMoveFeedToSection(draggedFeedId, section.folderId);
                      }}
                      className={`border-b border-border/70 transition-colors ${
                        dragOverSectionId === section.id
                          ? "bg-primary/5 ring-1 ring-inset ring-primary/30"
                          : dragModeActive && canDropIntoSection(section)
                            ? "bg-primary/[0.03]"
                            : ""
                      }`}
                    >
                      <div
                        className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-xs uppercase tracking-[0.18em] transition-colors ${
                          dragOverSectionId === section.id
                            ? "bg-primary/10 text-primary"
                            : dragModeActive && canDropIntoSection(section)
                              ? "text-primary/80"
                              : "text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Folder className="w-3.5 h-3.5" />
                          {section.name}
                        </div>
                        {dragModeActive && canDropIntoSection(section) && (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal">
                            Drop here
                          </span>
                        )}
                      </div>
                      {dragOverSectionId === section.id && canDropIntoSection(section) && (
                        <div className="mx-3 mb-2 rounded-md border border-dashed border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                          Drop into {section.name}
                        </div>
                      )}
                      {section.feeds.map((feed) => (
                        <div
                          key={feed.id}
                          className={`group w-full cursor-grab px-4 py-2 text-left hover:bg-muted/70 transition-colors flex items-start gap-2 ${
                            selectedFeed?.id === feed.id ? "bg-muted/50" : ""
                          } ${draggedFeedId === feed.id ? "opacity-50 cursor-grabbing" : ""}`}
                        >
                          <button
                            type="button"
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              beginSidebarDrag(feed);
                            }}
                            className={`mt-1 rounded p-1 text-muted-foreground transition-colors ${
                              draggedFeedId === feed.id
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted hover:text-foreground"
                            }`}
                            title={`Move ${feed.title}`}
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedFeed(feed);
                              handleViewModeChange("all");
                              if (isMobile) {
                                setMobileView("items");
                              }
                            }}
                            className="flex-1 flex items-start gap-2 min-w-0"
                          >
                            <div className="w-6 h-6 rounded bg-muted/80 flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                              {feed.imageUrl || feed.icon ? (
                                <img
                                  src={feed.imageUrl || feed.icon}
                                  alt=""
                                  className="w-6 h-6 object-cover"
                                />
                              ) : (
                                <Rss className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm text-foreground truncate">
                                  {feed.title}
                                </span>
                                {feed.unreadCount > 0 && (
                                  <span className="ml-1 px-1.5 bg-orange-500 text-white text-xs rounded-full">
                                    {feed.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          {/* Feed settings button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFeedSettingsFeed(feed);
                              setShowFeedSettings(true);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-all"
                            title="Feed settings"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}

                  {groupedFeeds.ungrouped.length > 0 && (
                    <div
                      className={`border-b border-border/70 transition-colors ${
                        dragOverSectionId === "ungrouped" ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
                      }`}
                      onPointerEnter={() => {
                        if (!draggedFeedId) return;
                        setDragOverSectionId("ungrouped");
                      }}
                      onPointerLeave={() => {
                        if (dragOverSectionId === "ungrouped") {
                          setDragOverSectionId(null);
                        }
                      }}
                      onPointerUp={() => {
                        if (!draggedFeedId) return;
                        handleMoveFeedToSection(draggedFeedId);
                      }}
                    >
                      {dragOverSectionId === "ungrouped" && (
                        <div className="mx-3 mt-2 rounded-md border border-dashed border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                          Remove from folder
                        </div>
                      )}
                      {groupedFeeds.ungrouped.map((feed) => (
                        <div
                          key={feed.id}
                          className={`group w-full cursor-grab px-3 py-2 text-left hover:bg-muted/70 transition-colors flex items-start gap-2 ${
                            selectedFeed?.id === feed.id ? "bg-muted/50" : ""
                          } ${draggedFeedId === feed.id ? "opacity-50 cursor-grabbing" : ""}`}
                        >
                          <button
                            type="button"
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              beginSidebarDrag(feed);
                            }}
                            className={`mt-1 rounded p-1 text-muted-foreground transition-colors ${
                              draggedFeedId === feed.id
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted hover:text-foreground"
                            }`}
                            title={`Move ${feed.title}`}
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedFeed(feed);
                              handleViewModeChange("all");
                              if (isMobile) {
                                setMobileView("items");
                              }
                            }}
                            className="flex-1 flex items-start gap-2 min-w-0"
                          >
                            <div className="w-6 h-6 rounded bg-muted/80 flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                              {feed.imageUrl || feed.icon ? (
                                <img
                                  src={feed.imageUrl || feed.icon}
                                  alt=""
                                  className="w-6 h-6 object-cover"
                                />
                              ) : (
                                <Rss className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm text-foreground truncate">
                                  {feed.title}
                                </span>
                                {feed.unreadCount > 0 && (
                                  <span className="ml-1 px-1.5 bg-orange-500 text-white text-xs rounded-full">
                                    {feed.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          {/* Feed settings button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFeedSettingsFeed(feed);
                              setShowFeedSettings(true);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-all"
                            title="Feed settings"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Tags as virtual feeds in sidebar */}
                  {tags.length > 0 && (
                    <div className="border-t border-border/70">
                      <div className="w-full px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-[0.18em]">
                        <Tag className="w-3.5 h-3.5" />
                        Tags
                      </div>
                      {tags.filter((t) => t.article_count && t.article_count > 0).map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            setViewMode("favorites");
                            setSelectedTagIds(new Set([tag.id]));
                            setTagFilter(tag.id);
                            if (isMobile) setMobileView("items");
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-muted/70 transition-colors flex items-center gap-2"
                        >
                          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Tag className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-sm text-foreground truncate flex-1">{tag.name}</span>
                          {tag.article_count != null && (
                            <span className="text-xs text-muted-foreground">{tag.article_count}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
            {/* Items list */}
            <div
              className={`w-full lg:w-[420px] border-b lg:border-b-0 lg:border-r border-border/70 flex-col min-h-0 ${showItemsList ? "flex" : "hidden"}`}
            >
              {/* Tag filter sidebar for saved stories */}
              {viewMode === "favorites" && tags.length > 0 && (
                <div className="px-3 py-2 border-b border-border/50">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Tag className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Tags</span>
                    {selectedTagIds.size > 0 && (
                      <button
                        onClick={() => { setSelectedTagIds(new Set()); setTagFilter(null); }}
                        className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tags.filter((t) => t.article_count && t.article_count > 0).map((tag) => {
                      const isSelected = selectedTagIds.has(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => {
                            setSelectedTagIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(tag.id)) next.delete(tag.id);
                              else next.add(tag.id);
                              return next;
                            });
                            setTagFilter(selectedTagIds.has(tag.id) ? null : tag.id);
                          }}
                          className={`px-2 py-0.5 text-[11px] rounded-full transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/70 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {tag.name}
                          {tag.article_count != null && (
                            <span className="ml-1 opacity-70">{tag.article_count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="px-5 pt-4 pb-3 border-b border-border/70 bg-gradient-to-b from-muted/20 via-muted/10 to-transparent">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate">
                      {itemsTitle}
                    </h3>
                    <p className="text-xs text-muted-foreground">{itemsSubtitle}</p>
                  </div>
                  {selectedFeed && (viewMode === "all" || viewMode === "unread") && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRefreshFeed(selectedFeed)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-lg mobile-density-tap"
                        title={t("rssReader.refreshFeed")}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMarkAllRead(selectedFeed.id)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-lg mobile-density-tap"
                        title={t("rssReader.markAllRead")}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveFeed(selectedFeed.id)}
                        className="p-2 text-destructive hover:bg-destructive/20 rounded-lg mobile-density-tap"
                        title={t("rssReader.unsubscribe")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder={t("rssReader.searchArticles")}
                    className="w-full pl-9 pr-3 py-2 bg-background/80 border border-border/70 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                </div>

                {/* View mode switchers */}
                <div className="mt-2 flex items-center gap-2">
                  <StoryViewModeSwitcher
                    currentMode={storyViewMode}
                    onModeChange={setStoryViewMode}
                    compact
                  />
                  <div className="flex items-center bg-muted/60 rounded-lg p-0.5">
                    {(["list", "magazine", "grid"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setArticleLayout(mode)}
                        className={`px-1.5 py-1 text-[10px] font-medium rounded-md capitalize transition-colors ${
                          articleLayout === mode
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Search results (FTS5) */}
              {viewMode === "search" && searchQuery && (
                <div className="p-3">
                  <SearchResults
                    results={searchResults}
                    query={searchQuery}
                    isLoading={isSearching}
                    onSelect={(result) => {
                      const feed = feeds.find((f) => f.id === result.feed_id);
                      if (feed) {
                        const item = feed.items.find((i) => i.id === result.id);
                        if (item) {
                          setSelectedItem(item);
                          setSelectedItemFeed(feed);
                        }
                      }
                    }}
                  />
                </div>
              )}

              {items.length === 0 && !(viewMode === "search" && searchQuery) ? (
                <div className="p-8 text-center text-muted-foreground mobile-density-section">
                  {viewMode === "unread" ? t("rssReader.noUnread") : t("rssReader.noArticles")}
                </div>
              ) : articleLayout === "magazine" ? (
                <div className="flex-1 overflow-y-auto transition-all duration-300">
                  <MagazineLayout
                    items={items}
                    onSelect={(feed, item) => handleItemClick(feed, item)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </div>
              ) : articleLayout === "grid" ? (
                <div className="flex-1 overflow-y-auto transition-all duration-300">
                  <GridLayout
                    items={items}
                    onSelect={(feed, item) => handleItemClick(feed, item)}
                    columnCount={preferences?.column_count ?? 3}
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto transition-all duration-300">
                  {items.map(({ feed, item }) => {
                    const imageUrl = item.enclosure?.type?.startsWith("image/")
                      ? item.enclosure.url
                      : undefined;
                    return (
                      <article
                        key={`${feed.id}-${item.id}`}
                        onClick={() => handleItemClick(feed, item)}
                        className={`group px-4 py-3 border-b border-border/60 hover:bg-muted/40 cursor-pointer transition-colors ${
                          selectedItem?.id === item.id ? "bg-muted/50" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-2 flex items-center gap-1.5 flex-shrink-0">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                item.read ? "bg-muted" : "bg-orange-500"
                              }`}
                            />
                            <IntelligenceIndicator score={item.intelligenceScore} />
                          </div>

                          {imageUrl && (
                            <div className="w-16 h-12 rounded-md overflow-hidden bg-muted/70 flex-shrink-0 border border-border/60">
                              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <h3
                              className={`text-sm font-semibold mb-1 ${
                                item.read ? "text-muted-foreground" : "text-foreground"
                              }`}
                            >
                              {item.title}
                            </h3>
                            {/* Show excerpt from full content if available, otherwise from description */}
                            {(item.fullContent || item.description) && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                {item.fullContent
                                  ? generateArticleExcerpt(item.fullContent, 150)
                                  : item.description.replace(/<[^>]+>/g, "")}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="font-medium truncate">{feed.title}</span>
                              <span>•</span>
                              <span>{formatFeedDate(item.pubDate)}</span>
                              {/* Full content availability indicator */}
                              {item.fullContent && (
                                <span className="flex items-center gap-1 text-blue-500">
                                  <span>•</span>
                                  <FileText className="w-3 h-3" />
                                  <span>Full</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            {/* Fetch Full Content quick action - only show if no full content */}
                            {!item.fullContent && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void fetchArticleFullContent(item.id, item.link);
                                }}
                                className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                                title="Fetch full content"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFavorite(feed, item);
                              }}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded transition-colors"
                              title={
                                item.favorite
                                  ? t("rssReader.removeFavorite")
                                  : t("rssReader.addFavorite")
                              }
                            >
                              {item.favorite ? (
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              ) : (
                                <StarOff className="w-4 h-4" />
                              )}
                            </button>
                            <a
                              href={item.link}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleOpenOriginal(item.link);
                              }}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded transition-colors"
                              title={t("rssReader.openOriginal")}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            {item.read && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleMarkUnread(feed, item);
                                }}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded transition-colors"
                                title="Mark as unread"
                              >
                                <EyeOff className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowTrainingMenu(true);
                                setTrainingMenuPosition({ x: e.clientX, y: e.clientY });
                              }}
                              className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors"
                              title="Train intelligence"
                            >
                              <GraduationCap className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(item);
                                setSelectedItemFeed(feed);
                                setShowTagInput(true);
                              }}
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                              title="Tag article"
                            >
                              <Tag className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Article preview */}
            <div
              className={`flex-1 flex flex-col min-h-0 bg-card/40 ${showReader ? "flex" : "hidden"}`}
            >
              {selectedItem ? (
                <>
                  <div className="px-6 py-4 border-b border-border/70 bg-gradient-to-r from-muted/20 via-muted/10 to-transparent flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-3">
                      {isMobile && (
                        <button
                          onClick={() => setMobileView("items")}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-lg"
                          title={t("rssReader.backToArticles")}
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-[0.18em]">
                          {selectedItemFeed?.title ?? t("rssReader.article")}
                        </p>
                        <h2 className="text-lg font-semibold text-foreground truncate">
                          {selectedItem.title}
                        </h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedItemFeed && (
                        <button
                          onClick={() => handleToggleFavorite(selectedItemFeed, selectedItem)}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-lg"
                          title={
                            selectedItem.favorite
                              ? t("rssReader.removeFavorite")
                              : t("rssReader.addFavorite")
                          }
                        >
                          {selectedItem.favorite ? (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          ) : (
                            <StarOff className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {/* View Full Content Toggle */}
                      <button
                        onClick={() => setShowFullContent(!showFullContent)}
                        className={`p-2 rounded-lg transition-colors ${
                          showFullContent
                            ? "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                        }`}
                        title={showFullContent ? "Show RSS Content" : "View Full Content"}
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      {/* Annotations toggle */}
                      <button
                        onClick={() => setShowAnnotations(!showAnnotations)}
                        className={`p-2 rounded-lg transition-colors ${
                          showAnnotations
                            ? "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                        }`}
                        title="Annotations"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      <a
                        href={selectedItem.link}
                        onClick={(e) => {
                          e.preventDefault();
                          void handleOpenOriginal(selectedItem.link);
                        }}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-lg"
                        title={t("rssReader.openOriginal")}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                  {/* Tag input bar */}
                  {selectedItem && (
                    <div className="px-4 py-2 border-b border-border/50 flex items-center gap-2">
                      <button
                        onClick={() => setShowTagInput(!showTagInput)}
                        className={`p-1 rounded transition-colors ${showTagInput ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/70"}`}
                        title="Tags"
                      >
                        <Tag className="w-3.5 h-3.5" />
                      </button>
                      {selectedArticleTags.length > 0 && !showTagInput && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {selectedArticleTags.map((tag) => (
                            <span key={tag.id} className="px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded-full">
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {showTagInput && selectedItem && (
                        <div className="flex-1">
                          <TagInput
                            articleId={selectedItem.id}
                            selectedTags={selectedArticleTags}
                            onTagAdd={(tag) => {
                              setSelectedArticleTags((prev) => [...prev, tag]);
                            }}
                            onTagRemove={(tagId) => {
                              setSelectedArticleTags((prev) => prev.filter((t) => t.id !== tagId));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto">
                    {/* Conditional view rendering based on storyViewMode */}
                    {storyViewMode === "original" && selectedItem.link ? (
                      <OriginalView item={selectedItem} />
                    ) : storyViewMode === "story" && selectedItemFeed ? (
                      <StoryView
                        item={selectedItem}
                        feed={selectedItemFeed}
                        items={items.map((i) => i.item)}
                        onSelectItem={(item) => {
                          const match = items.find((i) => i.item.id === item.id);
                          if (match) {
                            setSelectedItem(item);
                            setSelectedItemFeed(match.feed);
                          }
                        }}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ) : showFullContent ? (
                      <RSSFullContentView
                        item={selectedItem}
                      />
                    ) : (
                      <div className="reading-surface" style={readingStyles}>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4 reading-meta">
                          <span>{formatFeedDate(selectedItem.pubDate)}</span>
                          {selectedItem.author && <span>by {selectedItem.author}</span>}
                        </div>
                        <div
                          className="prose prose-sm max-w-none text-foreground dark:prose-invert reading-prose"
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            const link = target.closest("a[href]") as HTMLAnchorElement | null;
                            if (!link) return;
                            e.preventDefault();
                            void handleOpenOriginal(link.href);
                          }}
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(selectedItem.content || selectedItem.description || ""),
                          }}
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <Rss className="w-10 h-10 mb-3 opacity-60" />
                  <p>{t("rssReader.selectStory")}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Feed Dialog */}
        {showAddDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t("rssReader.addRssFeed")}
              </h2>
              <input
                type="url"
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowAddDialog(false);
                    setNewFeedUrl("");
                  }}
                  className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleAddFeed}
                  disabled={isAdding || !newFeedUrl}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {isAdding ? t("common.adding") : t("common.addFeed")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* URL Import Modal */}
        {showUrlImport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{t("rssReader.importNewsletter")}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t("rssReader.importNewsletterDesc")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUrlImport(false)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <NewsletterUrlImporter
                onSuccess={(_feed) => {
                  loadFeeds();
                  setShowUrlImport(false);
                }}
                onCancel={() => setShowUrlImport(false)}
              />
            </div>
          </div>
        )}

        {/* Customization Panel */}
        <RSSCustomizationPanel
          feedId={selectedFeed?.id}
          isOpen={showCustomization}
          onClose={() => setShowCustomization(false)}
          onSave={handleSavePreferences}
        />

        {/* Feed Settings Dialog */}
        <FeedSettingsDialog
          feed={feedSettingsFeed}
          isOpen={showFeedSettings}
          onClose={() => setShowFeedSettings(false)}
          onUpdate={(updatedFeed) => {
            setFeeds(feeds.map((f) => (f.id === updatedFeed.id ? updatedFeed : f)));
          }}
        />
      </div>

      {/* Newsletter Directory Modal */}
      {showNewsletterDirectory && (
        <div className="fixed inset-0 z-50 bg-black/50">
          <div className="h-full w-full bg-background">
            <button
              onClick={() => setShowNewsletterDirectory(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-muted/80 hover:bg-muted text-foreground rounded-lg backdrop-blur-sm transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <NewsletterDirectory
              onSubscribe={(_feed) => {
                // Refresh feeds after subscription
                loadFeeds();
              }}
              onClose={() => setShowNewsletterDirectory(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
