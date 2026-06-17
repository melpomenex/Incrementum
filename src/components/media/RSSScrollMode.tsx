/**
 * RSS Scroll Mode - TikTok-style vertical scrolling through RSS articles
 *
 * Features:
 * - Full-screen immersive article reading
 * - Interleaved feed items (variety mixing from different sources)
 * - Mouse wheel scroll navigation
 * - Keyboard navigation (arrow keys, space)
 * - Mark as read on scroll
 * - Smooth transitions between items
 * - Feed source indicator
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowsClockwise,
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  CheckCircle,
  CircleNotch,
  Clock,
  Eye,
  EyeSlash,
  GraduationCap,
  Info,
  Lightbulb,
  LinkSimple,
  Newspaper,
  Rss,
  Sparkle,
  Star,
  TextT,
  ThumbsDown,
  ThumbsUp,
  WarningCircle,
} from "@phosphor-icons/react";
import { supportsHaptics, playTrainLikeSound, playTrainDislikeSound } from "../../utils/soundService";
import {
  Feed,
  FeedItem,
  getSubscribedFeedsAuto,
  markItemReadAuto,
  toggleItemFavoriteAuto,
  formatFeedDate,
  getFeedIcon,
  getArticleFullContent,
  fetchArticleFullContent,
} from "../../api/rss";
import { cleanArticleHtml } from "./RSSFullContentView";
import { cn } from "../../utils";
import { sanitizeHtml } from "../common/RichContentRenderer";
import { createDocument, updateDocumentContent } from "../../api/documents";
import { useDocumentStore } from "../../stores/documentStore";
import { useToast } from "../common/Toast";
import { useUIStore } from "../../stores/uiStore";
import { CreateExtractDialog } from "../extracts/CreateExtractDialog";
import { EditExtractDialog } from "../extracts/EditExtractDialog";
import type { Extract } from "../../api/extracts";
import { useToastExtract } from "../../hooks/useToastExtract";
import { useSettingsStore } from "../../stores/settingsStore";
import { chatWithLLM, type LLMMessage } from "../../api/llm";
import { getAIConfig, type AIConfig } from "../../api/ai";
import { useLLMProvidersStore } from "../../stores/llmProvidersStore";
import { openExternal } from "../../lib/tauri";
import { copyShareLink } from "../../lib/shareLink";
import { stripTrackingParams } from "../../lib/cleanUrl";
import { useI18n } from "../../lib/i18n";
import { trimToTokenWindow } from "../../utils/tokenizer";
import { AssistantPanel, type AssistantContext } from "../assistant/AssistantPanel";
import { ArticleContextOverlay } from "./ArticleContextOverlay";
import { ModernSummaryPanel, SummaryBadge, SummaryActions } from "./summary";
import { useSummaryCache } from "../../utils/rssSummary";
import { SUMMARY_LENGTH_CONFIG, SUMMARY_LOADING_STAGES, type SummaryLength, type SummaryFocus } from "../../types/rssSummary";
import { TrainingMenu } from "./TrainingMenu";
import { useClassifiersStore } from "../../stores/classifiersStore";

interface RSSScrollItem {
  feed: Feed;
  item: FeedItem;
  index: number;
}

interface RSSScrollModeProps {
  onExit?: () => void;
  initialFeedId?: string | null;
}

type LegacySummaryMode = "terminal" | "assistant";
type AssistantPosition = "left" | "right";

// Session storage key for position
const RSS_SCROLL_POSITION_KEY = "rss-scroll-position";

/**
 * Interleave RSS items from different feeds for variety
 * Ensures users don't see multiple articles from the same feed back-to-back
 */
function interleaveFeedItems(items: RSSScrollItem[]): RSSScrollItem[] {
  if (items.length <= 2) return items;

  const result: RSSScrollItem[] = [];
  const feedGroups = new Map<string, RSSScrollItem[]>();

  // Group items by feed
  items.forEach((item) => {
    const feedId = item.feed.id;
    if (!feedGroups.has(feedId)) {
      feedGroups.set(feedId, []);
    }
    feedGroups.get(feedId)!.push(item);
  });

  // Sort feeds by number of items (descending) for better distribution
  const sortedFeeds = Array.from(feedGroups.entries()).sort((a, b) => b[1].length - a[1].length);

  // Round-robin distribution
  let addedCount = 0;
  const totalItems = items.length;

  while (addedCount < totalItems) {
    let addedInRound = 0;

    for (const [, feedItems] of sortedFeeds) {
      if (feedItems.length > 0) {
        const item = feedItems.shift()!;
        result.push(item);
        addedCount++;
        addedInRound++;
      }
    }

    // Break if no items were added in a complete round
    if (addedInRound === 0) break;
  }

  return result;
}

/**
 * Calculate engagement score for an item
 * Based on recency, unread status, and feed priority
 */
function calculateEngagementScore(item: RSSScrollItem): number {
  const pubDate = new Date(item.item.pubDate);
  const now = new Date();
  const ageHours = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);

  // Recency score: newer is better (max 10 points, decays over 72 hours)
  const recencyScore = Math.max(0, 10 - (ageHours / 72) * 10);

  // Unread bonus (5 points)
  const unreadBonus = item.item.read ? 0 : 5;

  // Favorite bonus (3 points)
  const favoriteBonus = item.item.favorite ? 3 : 0;

  // Random component for variety (0-2 points)
  const varietyBonus = Math.random() * 2;

  return recencyScore + unreadBonus + favoriteBonus + varietyBonus;
}

export function RSSScrollMode({ onExit, initialFeedId }: RSSScrollModeProps) {
  const { t } = useI18n();
  const { documents, addDocument, updateDocument } = useDocumentStore();
  const { settings } = useSettingsStore();
  const { addClassifier } = useClassifiersStore();
  const toast = useToast();
  const { createInstantExtract } = useToastExtract({
    onEditExtract: (extract) => {
      setEditExtractFromToast(extract);
      setIsEditExtractDialogOpen(true);
    },
  });
  const [scrollItems, setScrollItems] = useState<RSSScrollItem[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [renderedIndex, setRenderedIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [readItems, setReadItems] = useState<Set<string>>(new Set());
  const [selectedText, setSelectedText] = useState("");
  const [isExtractDialogOpen, setIsExtractDialogOpen] = useState(false);
  const [extractDocumentId, setExtractDocumentId] = useState<string | null>(null);
  const [editExtractFromToast, setEditExtractFromToast] = useState<Extract | null>(null);
  const [isEditExtractDialogOpen, setIsEditExtractDialogOpen] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(settings.rssQueue.showCoverImage ?? false);

  useEffect(() => {
    setIsImageExpanded(settings.rssQueue.showCoverImage ?? false);
  }, [renderedIndex, settings.rssQueue.showCoverImage]);
  const contentRef = useRef<HTMLDivElement>(null);
  const selectedTextRef = useRef("");
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  const scrollCooldown = 500; // ms between scroll actions
  const startTimeRef = useRef(Date.now());

  // Enhanced scroll mode state
  const [showJumpInput, setShowJumpInput] = useState(false);
  const [jumpTargetIndex, setJumpTargetIndex] = useState("");
  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [favoriteAnimation, setFavoriteAnimation] = useState<string | null>(null);
  // Brief "training registered" highlight on the thumbs-up/down buttons.
  const [trainPulse, setTrainPulse] = useState<"like" | "dislike" | null>(null);
  const trainPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Clear any pending train-pulse timer on unmount.
  useEffect(() => () => {
    if (trainPulseTimer.current) clearTimeout(trainPulseTimer.current);
  }, []);

  // Article context overlay state
  const [showContextOverlay, setShowContextOverlay] = useState(false);
  const [fullContentExpanded, setFullContentExpanded] = useState(false);

  // Full content states
  const [showFullContent, setShowFullContent] = useState(false);
  const [fullContentMap, setFullContentMap] = useState<Map<string, string>>(new Map());
  const [loadingFullContent, setLoadingFullContent] = useState<Set<string>>(new Set());
  const [fullContentErrors, setFullContentErrors] = useState<Map<string, string>>(new Map());

  const handleOpenOriginal = useCallback(async (url?: string) => {
    if (!url) return;
    try {
      await openExternal(url);
    } catch (error) {
      console.error("Failed to open original URL:", error);
    }
  }, []);

  const handleCopyLink = useCallback(async (rawUrl?: string) => {
    if (!rawUrl) return;
    const cleanUrl = stripTrackingParams(rawUrl);
    const ok = await copyShareLink(cleanUrl);
    if (ok) {
      toast.success(t("rss.linkCopied"), t("rss.linkCopiedDesc"));
    } else {
      toast.error(t("rss.failedToCopy"));
    }
  }, [toast, t]);

  const hasActiveSelectionInContent = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!text) return false;

    const container = contentRef.current;
    if (!container) return false;

    const anchorNode = selection?.anchorNode ?? null;
    const focusNode = selection?.focusNode ?? null;

    return !!(
      (anchorNode && container.contains(anchorNode)) ||
      (focusNode && container.contains(focusNode))
    );
  }, []);

  // Summary state
  const [summaryMode, setSummaryMode] = useState<LegacySummaryMode>(() => {
    const saved = localStorage.getItem("rss-summary-mode");
    return (saved as LegacySummaryMode) || "terminal";
  });
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [_displayedSummary, setDisplayedSummary] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [showTrainingMenu, setShowTrainingMenu] = useState(false);

  // Modern summary panel state
  const [modernSummaryLength, setModernSummaryLength] = useState<SummaryLength>(() => {
    const saved = localStorage.getItem("rss-summary-length");
    return (saved as SummaryLength) || "medium";
  });
  const [modernSummaryFocus, setModernSummaryFocus] = useState<SummaryFocus>(() => {
    const saved = localStorage.getItem("rss-summary-focus");
    return (saved as SummaryFocus) || "key-points";
  });
  const [modernSummaryMode, setModernSummaryMode] = useState<"modern" | "terminal">(() => {
    const saved = localStorage.getItem("rss-summary-display-mode");
    return (saved as "modern" | "terminal") || "modern";
  });
  const [loadingStage, setLoadingStage] = useState<
    "analyzing" | "extracting" | "synthesizing" | "complete"
  >("analyzing");
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Summary cache hook
  const { getCachedSummary, cacheSummary, setEntryPersisted, isCached } = useSummaryCache();

  // Auto-read mode - when enabled, marking one item as read auto-marks subsequent items
  const [autoReadMode, setAutoReadMode] = useState(() => {
    const saved = localStorage.getItem("rss-auto-read-mode");
    return saved === "true";
  });

  // Assistant panel state
  const [assistantPosition, setAssistantPosition] = useState<AssistantPosition>(() => {
    const saved = localStorage.getItem("rss-assistant-position");
    return (saved as AssistantPosition) || "right";
  });
  const [isAssistantVisible] = useState(() => {
    const saved = localStorage.getItem("rss-assistant-visible");
    return saved !== "false";
  });
  const [assistantContext, setAssistantContext] = useState<AssistantContext | undefined>(undefined);

  // Panel resize state
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem("rss-assistant-width");
    return saved ? parseInt(saved, 10) : 320; // default 320px (w-80)
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  // Swipe gesture and undo toast state
  const [undoState, setUndoState] = useState<{
    visible: boolean;
    action: "read" | "favorite";
    feedId: string;
    itemId: string;
    wasFavorite: boolean;
    progress: number;
  } | null>(null);

  const visibleScrollItems = useMemo(
    () => (favoritesOnly ? scrollItems.filter((si) => si.item.favorite) : scrollItems),
    [scrollItems, favoritesOnly]
  );

  useEffect(() => {
    const loadFeeds = async () => {
      const loadedFeeds = await getSubscribedFeedsAuto();

      let allItems: RSSScrollItem[] = [];
      loadedFeeds.forEach((feed) => {
        feed.items.forEach((item, idx) => {
          allItems.push({
            feed,
            item,
            index: idx,
          });
        });
      });

      // If initialFeedId is specified, prioritize items from that feed
      if (initialFeedId) {
        const fromInitialFeed = allItems.filter((i) => i.feed.id === initialFeedId);
        const fromOtherFeeds = allItems.filter((i) => i.feed.id !== initialFeedId);
        allItems = [...fromInitialFeed, ...fromOtherFeeds];
      }

      // Sort by engagement score
      allItems.sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a));

      // Apply variety mixing (interleave different feeds)
      const interleaved = interleaveFeedItems(allItems);

      setScrollItems(interleaved);

      // Restore position if available
      const savedPosition = sessionStorage.getItem(RSS_SCROLL_POSITION_KEY);
      if (savedPosition) {
        const pos = parseInt(savedPosition, 10);
        if (pos < interleaved.length) {
          setCurrentIndex(pos);
          setRenderedIndex(pos);
        }
      }
    };

    loadFeeds();
  }, [initialFeedId]);

  useEffect(() => {
    sessionStorage.setItem(RSS_SCROLL_POSITION_KEY, String(currentIndex));
  }, [currentIndex]);

  // Auto-update assistant context when article changes
  useEffect(() => {
    let cancelled = false;
    const item = visibleScrollItems[renderedIndex];

    if (!item) {
      setAssistantContext(undefined);
      return;
    }

    const buildContext = async () => {
      const maxTokens =
        settings?.ai?.maxTokens && settings.ai.maxTokens > 0 ? settings.ai.maxTokens : 2000;
      const aiModel = settings?.ai?.model;

      const rawContent = item.item.content || item.item.description || "";
      const plainText = htmlToText(rawContent);

      const title = item.item.title ? `Title: ${item.item.title}` : null;
      const content = [title, plainText].filter(Boolean).join("\n\n");
      const trimmed = content ? await trimToTokenWindow(content, maxTokens, aiModel) : undefined;

      if (!cancelled) {
        setAssistantContext({
          type: "web",
          url: item.item.link || `rss:${item.item.id}`,
          content: trimmed || undefined,
          contextWindowTokens: maxTokens,
          metadata: {
            title: item.item.title,
          },
        });
      }
    };

    void buildContext();
    return () => {
      cancelled = true;
    };
  }, [renderedIndex, visibleScrollItems, settings?.ai?.maxTokens, settings?.ai?.model]);

  useEffect(() => {
    localStorage.setItem("rss-auto-read-mode", String(autoReadMode));
  }, [autoReadMode]);

  useEffect(() => {
    // When navigating to a new item and auto-read mode is on, mark it as read
    if (!autoReadMode) return;

    const currentItem = visibleScrollItems[currentIndex];
    if (!currentItem) return;

    const itemKey = `${currentItem.feed.id}-${currentItem.item.id}`;
    if (readItems.has(itemKey) || currentItem.item.read) return;
    if (currentItem.item.favorite) return; // Don't auto-mark favorites

    // Small delay to let user see the article first
    const timer = setTimeout(() => {
      handleMarkRead(currentItem.feed.id, currentItem.item.id);
    }, 2000);

    return () => clearTimeout(timer);
  }, [currentIndex, autoReadMode, visibleScrollItems]); // Only trigger on navigation, not on source list changes

  // Load/fetch full content for the active RSS item
  useEffect(() => {
    const activeItem = visibleScrollItems[currentIndex];
    if (!activeItem || !showFullContent) return;

    const item = activeItem.item;
    const itemId = item.id;
    const itemLink = item.link;

    // 1. Already in memory map
    if (fullContentMap.has(itemId)) return;

    // 2. Already in active item object
    if (item.fullContent) {
      setFullContentMap((prev) => {
        const next = new Map(prev);
        next.set(itemId, item.fullContent!);
        return next;
      });
      return;
    }

    const loadContent = async () => {
      setLoadingFullContent((prev) => {
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });
      setFullContentErrors((prev) => {
        const next = new Map(prev);
        next.delete(itemId);
        return next;
      });

      try {
        // Try getting cached content first
        const cached = await getArticleFullContent(itemId);
        if (cached?.content) {
          setFullContentMap((prev) => {
            const next = new Map(prev);
            next.set(itemId, cached.content!);
            return next;
          });
          // Update item in scroll list to keep it updated
          setScrollItems((prev) =>
            prev.map((si) =>
              si.item.id === itemId
                ? {
                    ...si,
                    item: {
                      ...si.item,
                      fullContent: cached.content,
                      fullContentFetchedAt: cached.fetchedAt,
                    },
                  }
                : si
            )
          );
        } else {
          // Fetch from network/API
          const result = await fetchArticleFullContent(itemId, itemLink);
          if (result.success && result.fullContent) {
            setFullContentMap((prev) => {
              const next = new Map(prev);
              next.set(itemId, result.fullContent!);
              return next;
            });
            // Update item in scroll list
            setScrollItems((prev) =>
              prev.map((si) =>
                si.item.id === itemId
                  ? {
                      ...si,
                      item: {
                        ...si.item,
                        fullContent: result.fullContent,
                        fullContentFetchedAt: result.fetchedAt,
                      },
                    }
                  : si
              )
            );
          } else {
            setFullContentErrors((prev) => {
              const next = new Map(prev);
              next.set(itemId, result.error || "Failed to fetch full article content");
              return next;
            });
          }
        }
      } catch (err) {
        setFullContentErrors((prev) => {
          const next = new Map(prev);
          next.set(itemId, err instanceof Error ? err.message : "Unknown error occurred");
          return next;
        });
      } finally {
        setLoadingFullContent((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    };

    void loadContent();
  }, [currentIndex, showFullContent, visibleScrollItems]);

  // Navigation functions
  const goToNext = useCallback(() => {
    if (currentIndex < visibleScrollItems.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      startTimeRef.current = Date.now();

      setTimeout(() => {
        setRenderedIndex(nextIndex);
        setIsTransitioning(false);
      }, 300);
    }
  }, [currentIndex, visibleScrollItems.length, isTransitioning]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      startTimeRef.current = Date.now();

      setTimeout(() => {
        setRenderedIndex(prevIndex);
        setIsTransitioning(false);
      }, 300);
    }
  }, [currentIndex, isTransitioning]);

  useEffect(() => {
    if (visibleScrollItems.length === 0) {
      setCurrentIndex(0);
      setRenderedIndex(0);
      return;
    }
    setCurrentIndex((prev) => Math.min(prev, visibleScrollItems.length - 1));
    setRenderedIndex((prev) => Math.min(prev, visibleScrollItems.length - 1));
  }, [visibleScrollItems.length]);

  // Mouse wheel scroll detection
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Do not navigate while user is selecting text.
      if (hasActiveSelectionInContent()) {
        return;
      }

      const now = Date.now();
      if (now - lastScrollTime.current < scrollCooldown) {
        return;
      }

      // Minimum delta threshold to prevent accidental navigation (10 pixels)
      const minDeltaThreshold = 10;
      if (Math.abs(e.deltaY) < minDeltaThreshold) {
        return;
      }

      // Find scrollable content within current item
      const target = e.target as HTMLElement;
      const scrollableContent = target.closest(".rss-article-content") as HTMLElement | null;

      if (scrollableContent) {
        const canScrollDown =
          scrollableContent.scrollTop <
          scrollableContent.scrollHeight - scrollableContent.clientHeight - 10;
        const canScrollUp = scrollableContent.scrollTop > 10;

        // If content can still scroll, let it scroll
        if (e.deltaY > 0 && canScrollDown) return;
        if (e.deltaY < 0 && canScrollUp) return;
      }

      lastScrollTime.current = now;

      if (e.deltaY > 0) {
        goToNext();
      } else if (e.deltaY < 0) {
        goToPrevious();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: true });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [goToNext, goToPrevious, hasActiveSelectionInContent]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if command palette is open
      if (useUIStore.getState().commandPaletteOpen) {
        return;
      }

      // Don't trigger if typing in input
      if (
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowDown":
        case "PageDown":
        case " ":
          if (hasActiveSelectionInContent()) {
            return;
          }
          e.preventDefault();
          goToNext();
          break;
        case "ArrowUp":
        case "PageUp":
          if (hasActiveSelectionInContent()) {
            return;
          }
          e.preventDefault();
          goToPrevious();
          break;
        case "Escape":
          if (showJumpInput) {
            setShowJumpInput(false);
            setJumpTargetIndex("");
          } else if (showMarkAllConfirm) {
            setShowMarkAllConfirm(false);
          } else {
            onExit?.();
          }
          break;
        case "h":
        case "H":
          // If summary is open, close it
          if (showSummary) {
            e.preventDefault();
            closeSummary();
          }
          break;
        case "?":
          setShowControls((prev) => !prev);
          break;
        case "s":
        case "S":
          e.preventDefault();
          if (showSummary) {
            closeSummary();
          } else {
            void handleSummarize();
          }
          break;
        case "j":
          e.preventDefault();
          setShowJumpInput(true);
          break;
        case "i":
          e.preventDefault();
          setShowContextOverlay(true);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    goToNext,
    goToPrevious,
    onExit,
    hasActiveSelectionInContent,
    showJumpInput,
    showMarkAllConfirm,
  ]);

  // Auto-hide controls
  useEffect(() => {
    let hideTimeout: ReturnType<typeof setTimeout>;

    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(hideTimeout);
    };
  }, []);

  const handleToggleFavorite = useCallback(async (feedId: string, itemId: string) => {
    try {
      await toggleItemFavoriteAuto(feedId, itemId);
    } catch (error) {
      console.warn("Failed to toggle favorite:", error);
    }
    // Always update local state regardless of API success
    setScrollItems((prev) =>
      prev.map((si) =>
        si.feed.id === feedId && si.item.id === itemId
          ? { ...si, item: { ...si.item, favorite: !si.item.favorite } }
          : si
      )
    );
    const articleId = `${feedId}-${itemId}`;
    const willBeFavorite = !scrollItems.find(si => si.feed.id === feedId && si.item.id === itemId)?.item.favorite;
    setEntryPersisted(articleId, willBeFavorite);
  }, [scrollItems, setEntryPersisted]);

  // Quick train: thumbs up/down on current article
  const handleQuickTrain = useCallback(async (sentiment: "like" | "dislike") => {
    const current = visibleScrollItems[currentIndex];
    if (!current) return;
    const { feed, item } = current;
    const value = item.author || item.categories?.[0] || "";

    // Tactile feedback: distinct sound + haptic the moment the button is pressed,
    // so the user knows the action registered before the async write resolves.
    if (value) {
      if (sentiment === "like") playTrainLikeSound();
      else playTrainDislikeSound();
      triggerHaptic();
    }

    // Flash the pressed thumbs button for an immediate visual "it went through".
    setTrainPulse(sentiment);
    if (trainPulseTimer.current) clearTimeout(trainPulseTimer.current);
    trainPulseTimer.current = setTimeout(() => setTrainPulse(null), 600);

    if (!value) {
      toast.error("Cannot train", "Article has no author or tags");
      return;
    }
    const classifierType = item.author ? "author" : "tag";
    try {
      await addClassifier(feed.id, classifierType, value, sentiment, "feed");
      // Use toast.info (no sound) so it doesn't double up with the dedicated
      // train sound already played above; this toast carries the detail text.
      toast.info(
        sentiment === "like" ? "Liked" : "Disliked",
        `Training on ${classifierType}: ${value}`
      );
    } catch (err) {
      toast.error("Training failed", err instanceof Error ? err.message : "Unknown error");
    }
  }, [visibleScrollItems, currentIndex, addClassifier, toast]);

  // Handle mark as read - removes item from scroll list (except favorites)
  const handleMarkRead = useCallback(
    async (feedId: string, itemId: string, shouldToggleAutoRead = false) => {
      // Toggle auto-read mode if requested (user clicked the button)
      if (shouldToggleAutoRead) {
        setAutoReadMode((prev) => !prev);
      }

      try {
        await markItemReadAuto(feedId, itemId, true);
      } catch (error) {
        console.warn("Failed to mark as read:", error);
      }

      // Find the item to check if it's favorited
      const itemToRemove = scrollItems.find((si) => si.feed.id === feedId && si.item.id === itemId);

      // Don't remove if favorited - preserve for later access
      if (itemToRemove?.item.favorite) {
        const itemKey = `${feedId}-${itemId}`;
        setReadItems((prev) => new Set(prev).add(itemKey));
        return;
      }

      const itemVisibleIndex = visibleScrollItems.findIndex(
        (si) => si.feed.id === feedId && si.item.id === itemId
      );
      if (itemVisibleIndex === -1) return;

      const newItems = scrollItems.filter(
        (si) => !(si.feed.id === feedId && si.item.id === itemId)
      );
      setScrollItems(newItems);

      // Adjust indices after removal (use functional updates to avoid stale closures)
      if (itemVisibleIndex < currentIndex) {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      }
      if (itemVisibleIndex < renderedIndex) {
        setRenderedIndex((prev) => Math.max(0, prev - 1));
      }
      // If we removed the current item, stay at same index (next item slides in)
      // No need to change currentIndex since we removed current and next becomes current

      // Track in read items set
      const itemKey = `${feedId}-${itemId}`;
      setReadItems((prev) => new Set(prev).add(itemKey));
    },
    [scrollItems, visibleScrollItems, currentIndex, renderedIndex]
  );

  // Swipe gesture handlers with undo toast
  const handleSwipeMarkRead = useCallback(
    async (feedId: string, itemId: string) => {
      const item = scrollItems.find((si) => si.feed.id === feedId && si.item.id === itemId);
      if (!item) return;

      const wasFavorite = item.item.favorite;

      // Store original state for undo
      const undoData = {
        action: "read" as const,
        feedId,
        itemId,
        wasFavorite,
      };

      // Mark as read (but don't remove favorites from scroll list)
      try {
        await markItemReadAuto(feedId, itemId, true);
      } catch (error) {
        console.warn("Failed to mark as read:", error);
      }

      setScrollItems((prev) =>
        prev.map((si) =>
          si.feed.id === feedId && si.item.id === itemId
            ? { ...si, item: { ...si.item, read: true } }
            : si
        )
      );

      const itemKey = `${feedId}-${itemId}`;
      setReadItems((prev) => new Set(prev).add(itemKey));

      setUndoState({
        visible: true,
        ...undoData,
        progress: 100,
      });

      const startTime = Date.now();
      const duration = 3000;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);

        setUndoState((prev) => (prev ? { ...prev, progress: remaining } : null));

        if (elapsed < duration && undoState?.visible) {
          requestAnimationFrame(animate);
        } else {
          setUndoState((prev) => (prev ? { ...prev, visible: false } : null));
        }
      };

      requestAnimationFrame(animate);
    },
    [scrollItems, undoState?.visible]
  );

  const handleSwipeFavorite = useCallback(
    async (feedId: string, itemId: string) => {
      const item = scrollItems.find((si) => si.feed.id === feedId && si.item.id === itemId);
      if (!item) return;

      const wasFavorite = item.item.favorite;

      // Toggle favorite
      try {
        await toggleItemFavoriteAuto(feedId, itemId);
      } catch (error) {
        console.warn("Failed to toggle favorite:", error);
      }

      setScrollItems((prev) =>
        prev.map((si) =>
          si.feed.id === feedId && si.item.id === itemId
            ? { ...si, item: { ...si.item, favorite: !si.item.favorite } }
            : si
        )
      );

      setEntryPersisted(`${feedId}-${itemId}`, !wasFavorite);

      setUndoState({
        visible: true,
        action: "favorite",
        feedId,
        itemId,
        wasFavorite,
        progress: 100,
      });

      const startTime = Date.now();
      const duration = 3000;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);

        setUndoState((prev) => (prev ? { ...prev, progress: remaining } : null));

        if (elapsed < duration && undoState?.visible) {
          requestAnimationFrame(animate);
        } else {
          setUndoState((prev) => (prev ? { ...prev, visible: false } : null));
        }
      };

      requestAnimationFrame(animate);
    },
    [scrollItems, undoState?.visible]
  );

  // Touch gesture handlers for swipe actions and vertical navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let currentX = 0;
    let currentY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      currentX = touchStartX;
      currentY = touchStartY;
      touchStartTime = Date.now();
    };

    const handleTouchMove = (e: TouchEvent) => {
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
    };

    const handleTouchEnd = () => {
      // If text is actively selected, don't interpret gesture as navigation/swipe action.
      if (hasActiveSelectionInContent()) {
        return;
      }

      const touchEndX = currentX;
      const touchEndY = currentY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const deltaTime = Date.now() - touchStartTime;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;

      // Minimum thresholds for swipe gestures
      const minSwipeDistance = 50;
      const minVelocity = 0.3;

      if (absDeltaX > absDeltaY) {
        // Horizontal gesture - check for swipe actions
        if (absDeltaX > minSwipeDistance && velocity > minVelocity) {
          const currentItem = visibleScrollItems[currentIndex];
          if (currentItem) {
            const scrollableContent = container.querySelector(
              ".rss-article-content"
            ) as HTMLElement;
            if (scrollableContent) {
              const canScrollLeft = scrollableContent.scrollLeft > 0;
              const canScrollRight =
                scrollableContent.scrollLeft <
                scrollableContent.scrollWidth - scrollableContent.clientWidth - 10;

              // If content can scroll horizontally, let it scroll
              if ((deltaX > 0 && canScrollLeft) || (deltaX < 0 && canScrollRight)) {
                return;
              }
            }

            // Swipe right = mark as read
            if (deltaX > 0) {
              triggerHaptic();
              handleSwipeMarkRead(currentItem.feed.id, currentItem.item.id);
            }
            // Swipe left = favorite
            else if (deltaX < 0) {
              triggerHaptic();
              handleSwipeFavorite(currentItem.feed.id, currentItem.item.id);
            }
          }
        }
      } else {
        // Vertical gesture - check for navigation
        if (absDeltaY > minSwipeDistance && velocity > minVelocity) {
          const scrollableContent = container.querySelector(".rss-article-content") as HTMLElement;
          if (scrollableContent) {
            const canScrollDown =
              scrollableContent.scrollTop <
              scrollableContent.scrollHeight - scrollableContent.clientHeight - 10;
            const canScrollUp = scrollableContent.scrollTop > 10;

            // If content can still scroll, let it scroll
            if (deltaY > 0 && canScrollDown) return;
            if (deltaY < 0 && canScrollUp) return;
          }

          // Swipe up = next item, Swipe down = previous item
          if (deltaY < 0) {
            goToNext();
          } else if (deltaY > 0) {
            goToPrevious();
          }
        }
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [
    visibleScrollItems,
    currentIndex,
    goToNext,
    goToPrevious,
    handleSwipeMarkRead,
    handleSwipeFavorite,
    hasActiveSelectionInContent,
  ]);

  const handleUndo = useCallback(async () => {
    if (!undoState) return;

    try {
      if (undoState.action === "read") {
        // ArrowCounterClockwise mark as read - mark as unread
        await markItemReadAuto(undoState.feedId, undoState.itemId, false);
        setScrollItems((prev) =>
          prev.map((si) =>
            si.feed.id === undoState.feedId && si.item.id === undoState.itemId
              ? { ...si, item: { ...si.item, read: false } }
              : si
          )
        );
        setReadItems((prev) => {
          const newSet = new Set(prev);
          newSet.delete(`${undoState.feedId}-${undoState.itemId}`);
          return newSet;
        });
        toast.success("ArrowCounterClockwise", "Marked as unread");
      } else if (undoState.action === "favorite") {
        // ArrowCounterClockwise favorite toggle - toggle back
        await toggleItemFavoriteAuto(undoState.feedId, undoState.itemId);
        setScrollItems((prev) =>
          prev.map((si) =>
            si.feed.id === undoState.feedId && si.item.id === undoState.itemId
              ? { ...si, item: { ...si.item, favorite: undoState.wasFavorite } }
              : si
          )
        );
        toast.success("ArrowCounterClockwise", "Favorite status restored");
      }
    } catch (error) {
      console.error("Failed to undo:", error);
      toast.error("Failed to undo", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setUndoState(null);
    }
  }, [undoState, toast]);

  // Haptic feedback helper
  const triggerHaptic = useCallback(() => {
    if (supportsHaptics()) {
      navigator.vibrate(50); // Short 50ms vibration
    }
  }, []);

  // Jump to specific article index
  const handleJumpToIndex = useCallback(() => {
    const target = parseInt(jumpTargetIndex, 10) - 1; // Convert to 0-based index
    if (isNaN(target) || target < 0 || target >= visibleScrollItems.length) {
      toast.error(
        "Invalid article number",
        `Please enter a number between 1 and ${visibleScrollItems.length}`
      );
      return;
    }

    setIsTransitioning(true);
    setCurrentIndex(target);
    setTimeout(() => {
      setRenderedIndex(target);
      setIsTransitioning(false);
    }, 300);
    setShowJumpInput(false);
    setJumpTargetIndex("");
  }, [jumpTargetIndex, visibleScrollItems.length, toast]);

  // Progress bar click handler
  const handleProgressBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressBarRef.current || visibleScrollItems.length === 0) return;

      const rect = progressBarRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const targetIndex = Math.floor(percentage * visibleScrollItems.length);

      const clampedIndex = Math.max(0, Math.min(visibleScrollItems.length - 1, targetIndex));

      setIsTransitioning(true);
      setCurrentIndex(clampedIndex);
      setTimeout(() => {
        setRenderedIndex(clampedIndex);
        setIsTransitioning(false);
      }, 300);
    },
    [visibleScrollItems.length]
  );

  // Mark all as read handler
  const handleMarkAllRead = useCallback(async () => {
    setIsMarkingAllRead(true);
    const itemsToMark = visibleScrollItems.filter(
      (si) => !si.item.favorite && !si.item.read && !readItems.has(`${si.feed.id}-${si.item.id}`)
    );

    try {
      // Mark all items as read
      await Promise.all(itemsToMark.map((si) => markItemReadAuto(si.feed.id, si.item.id, true)));

      const newReadItems = new Set(readItems);
      itemsToMark.forEach((si) => {
        newReadItems.add(`${si.feed.id}-${si.item.id}`);
      });
      setReadItems(newReadItems);

      const favoriteIds = new Set(
        visibleScrollItems
          .filter((si) => si.item.favorite)
          .map((si) => `${si.feed.id}-${si.item.id}`)
      );
      setScrollItems((prev) => prev.filter((si) => favoriteIds.has(`${si.feed.id}-${si.item.id}`)));

      toast.success("Marked all as read", `${itemsToMark.length} articles marked as read`, {
        action: {
          label: "ArrowCounterClockwise",
          onClick: async () => {
            // ArrowCounterClockwise: mark all as unread
            await Promise.all(
              itemsToMark.map((si) => markItemReadAuto(si.feed.id, si.item.id, false))
            );
            // Reload feeds to restore items
            const loadedFeeds = await getSubscribedFeedsAuto();
            let allItems: RSSScrollItem[] = [];
            loadedFeeds.forEach((feed) => {
              feed.items.forEach((item, idx) => {
                allItems.push({ feed, item, index: idx });
              });
            });
            allItems.sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a));
            const interleaved = interleaveFeedItems(allItems);
            setScrollItems(interleaved);
            toast.success("ArrowCounterClockwise", "Articles restored");
          },
        },
      });
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error(
        "Failed to mark all as read",
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setIsMarkingAllRead(false);
      setShowMarkAllConfirm(false);
    }
  }, [visibleScrollItems, readItems, toast]);

  // Enhanced favorite toggle with animation
  const handleToggleFavoriteAnimated = useCallback(
    async (feedId: string, itemId: string) => {
      const itemKey = `${feedId}-${itemId}`;
      const currentItem = visibleScrollItems.find(
        (si) => si.feed.id === feedId && si.item.id === itemId
      );
      const willBeFavorite = !currentItem?.item.favorite;

      setFavoriteAnimation(itemKey);
      setTimeout(() => setFavoriteAnimation(null), 500);

      // Trigger haptic feedback when favoriting
      if (willBeFavorite) {
        triggerHaptic();
      }

      await handleToggleFavorite(feedId, itemId);
    },
    [visibleScrollItems, handleToggleFavorite, triggerHaptic]
  );

  const updateSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!text) {
      setSelectedText("");
      selectedTextRef.current = "";
      return;
    }

    const container = contentRef.current;
    const anchorNode = selection?.anchorNode ?? null;
    const focusNode = selection?.focusNode ?? null;
    const selectionInContainer =
      !!container &&
      ((anchorNode && container.contains(anchorNode)) ||
        (focusNode && container.contains(focusNode)));
    if (!selectionInContainer) {
      setSelectedText("");
      selectedTextRef.current = "";
      return;
    }

    if (text.length > 10000) {
      setSelectedText("");
      selectedTextRef.current = "";
      return;
    }

    setSelectedText(text);
    selectedTextRef.current = text;
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateSelection);

    return () => {
      document.removeEventListener("selectionchange", updateSelection);
    };
  }, [updateSelection]);

  // Clear selection when changing items
  useEffect(() => {
    setSelectedText("");
    selectedTextRef.current = "";
    window.getSelection()?.removeAllRanges();
  }, [renderedIndex]);

  // Handle prepare extract - creates document and creates extract instantly
  const handlePrepareExtract = useCallback(async () => {
    const currentItem = visibleScrollItems[renderedIndex];
    // Use ref to get text in case selection was cleared
    const textToExtract = selectedTextRef.current || selectedText;
    if (!currentItem || !textToExtract) return;

    const rssItem = currentItem.item;
    const rssContent = rssItem.content || rssItem.description || "";
    const rssLink = rssItem.link || `rss:${rssItem.id}`;
    const existingDoc = documents.find((doc) => doc.filePath === rssLink);
    let docId = existingDoc?.id;

    try {
      if (!docId) {
        const created = await createDocument(
          rssItem.title || currentItem.feed.title,
          rssLink,
          "html"
        );
        addDocument(created);
        docId = created.id;
      }

      if (rssContent && docId) {
        await updateDocumentContent(docId, rssContent);
        updateDocument(docId, {
          content: rssContent,
          title: rssItem.title || currentItem.feed.title,
          filePath: rssLink,
          fileType: "html",
        });
      }

      if (docId) {
        await createInstantExtract({
          documentId: docId,
          text: textToExtract,
        });
      }

      // Clear selection
      setSelectedText("");
      selectedTextRef.current = "";
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error("Failed to prepare extract:", error);
      toast.error(
        "Failed to prepare extract",
        error instanceof Error ? error.message : "An error occurred"
      );
    }
  }, [
    visibleScrollItems,
    renderedIndex,
    selectedText,
    documents,
    addDocument,
    updateDocument,
    toast,
    createInstantExtract,
  ]);

  // Handle extract created (from full dialog)
  const handleExtractCreated = useCallback(() => {
    setSelectedText("");
    selectedTextRef.current = "";
    window.getSelection()?.removeAllRanges();
    setIsExtractDialogOpen(false);
    toast.success("Extract created", "Saved from RSS article.");
  }, [toast]);

  const handlePrepareExtractForDialog = useCallback(async () => {
    const currentItem = visibleScrollItems[renderedIndex];
    const textToExtract = selectedTextRef.current || selectedText;
    if (!currentItem || !textToExtract) return;

    const rssItem = currentItem.item;
    const rssContent = rssItem.content || rssItem.description || "";
    const rssLink = rssItem.link || `rss:${rssItem.id}`;
    const existingDoc = documents.find((doc) => doc.filePath === rssLink);
    let docId = existingDoc?.id;

    try {
      if (!docId) {
        const created = await createDocument(
          rssItem.title || currentItem.feed.title,
          rssLink,
          "html"
        );
        addDocument(created);
        docId = created.id;
      }

      if (rssContent && docId) {
        await updateDocumentContent(docId, rssContent);
        updateDocument(docId, {
          content: rssContent,
          title: rssItem.title || currentItem.feed.title,
          filePath: rssLink,
          fileType: "html",
        });
      }

      setExtractDocumentId(docId ?? null);
      setIsExtractDialogOpen(true);
    } catch (error) {
      console.error("Failed to prepare extract:", error);
      toast.error(
        "Failed to prepare extract",
        error instanceof Error ? error.message : "An error occurred"
      );
    }
  }, [
    visibleScrollItems,
    renderedIndex,
    selectedText,
    documents,
    addDocument,
    updateDocument,
    toast,
  ]);

  useEffect(() => {
    localStorage.setItem("rss-summary-mode", summaryMode);
  }, [summaryMode]);

  useEffect(() => {
    localStorage.setItem("rss-assistant-visible", String(isAssistantVisible));
  }, [isAssistantVisible]);

  useEffect(() => {
    localStorage.setItem("rss-assistant-position", assistantPosition);
  }, [assistantPosition]);

  useEffect(() => {
    localStorage.setItem("rss-summary-length", modernSummaryLength);
  }, [modernSummaryLength]);

  useEffect(() => {
    localStorage.setItem("rss-summary-focus", modernSummaryFocus);
  }, [modernSummaryFocus]);

  useEffect(() => {
    localStorage.setItem("rss-summary-display-mode", modernSummaryMode);
  }, [modernSummaryMode]);

  // Typewriter effect for summary
  useEffect(() => {
    if (!showSummary || summaryMode !== "terminal" || !summaryText) return;

    let currentIndex = 0;
    const text = summaryText;
    setDisplayedSummary("");

    const typeChar = () => {
      if (currentIndex < text.length) {
        const char = text[currentIndex];
        setDisplayedSummary((prev) => prev + char);
        currentIndex++;
        // Random typing speed for realistic effect
        const delay = Math.random() * 15 + 5;
        setTimeout(typeChar, delay);
      }
    };

    const timeoutId = setTimeout(typeChar, 100);
    return () => clearTimeout(timeoutId);
  }, [showSummary, summaryText, summaryMode]);

  // Helper to strip HTML and convert to markdown-like text
  const htmlToText = (html: string): string => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;

    let text = tmp.textContent || tmp.innerText || "";

    text = text.replace(/\s+/g, " ").trim();

    return text;
  };

  const handleSummarize = useCallback(
    async (params?: { length?: SummaryLength; focus?: SummaryFocus }) => {
      const currentItem = visibleScrollItems[renderedIndex];
      if (!currentItem || isSummarizing) return;

      const rawContent = currentItem.item.content || currentItem.item.description || "";
      // Convert HTML to clean text
      const content = htmlToText(rawContent);

      if (!content.trim()) {
        toast.error(t("queueScroll.noContentToSummarize"));
        return;
      }

      const length = params?.length || modernSummaryLength;
      const focus = params?.focus || modernSummaryFocus;

      const articleId = `${currentItem.feed.id}-${currentItem.item.id}`;
      const cached = getCachedSummary(articleId, content);

      // If we have a valid cached summary with matching parameters, use it
      if (cached && cached.length === length && cached.focus === focus) {
        setSummaryText(cached.content);
        setShowSummary(true);
        return;
      }

      // Resolve AI provider — try old AIConfig first, then LLMProvidersStore
      let providerType: string = "openrouter";
      let apiKey: string | undefined;
      let model: string | undefined;
      let baseUrl: string | undefined;

      // 1. Try old AIConfig (Rust-side, in-memory only)
      let aiConfig: AIConfig | null = null;
      try { aiConfig = await getAIConfig(); } catch { /* AIConfig may not be initialized yet */ }

      if (aiConfig?.default_provider && aiConfig.api_keys) {
        const providerMap: Record<string, string> = {
          OpenAI: "openai", Anthropic: "anthropic", OpenRouter: "openrouter", Ollama: "ollama",
        };
        providerType = providerMap[aiConfig.default_provider] ?? "openrouter";
        apiKey = providerType === "ollama"
          ? undefined
          : (aiConfig.api_keys as Record<string, string | undefined>)[providerType] ?? undefined;
        model = String(aiConfig.models?.[`${providerType}_model` as keyof typeof aiConfig.models] ?? "");
        baseUrl = providerType === "ollama"
          ? (aiConfig.local_settings?.ollama_base_url || undefined) : undefined;
      }

      // 2. Fallback to LLMProvidersStore (Zustand/persisted) if no API key found
      if (!apiKey) {
        const providers = useLLMProvidersStore.getState().getEnabledProviders();
        const withKey = providers.filter(p => p.apiKey && p.apiKey.trim().length > 0 && p.provider !== "ollama");
        const chosen = withKey[0] || providers.find(p => p.provider === "ollama");
        if (chosen) {
          providerType = chosen.provider;
          apiKey = chosen.apiKey || undefined;
          model = chosen.model || undefined;
          baseUrl = chosen.baseUrl || undefined;
        }
      }

      if (providerType !== "ollama" && !apiKey) {
        toast.error(t("queueScroll.noProviderConfigured"));
        return;
      }

      setIsSummarizing(true);
      setSummaryText("");
      setDisplayedSummary("");
      setShowSummary(true);
      setLoadingStage("analyzing");
      setLoadingProgress(SUMMARY_LOADING_STAGES.analyzing.progress);

      try {
        setLoadingStage("analyzing");

        const tokenLimit = SUMMARY_LENGTH_CONFIG[length].tokens;
        const inputWindow = settings?.ai?.maxTokens && settings.ai.maxTokens > 0 ? settings.ai.maxTokens : 4000;
        const trimmedContent = await trimToTokenWindow(content, inputWindow, String(model || ""));

        const focusInstruction = focus === "actionable"
          ? "Focus on actionable takeaways and next steps."
          : focus === "background"
            ? "Provide background context and explain why this matters."
            : "Focus on key points and main conclusions.";

        const messages: LLMMessage[] = [
          {
            role: "system",
            content: `You are a concise article summarizer. ${focusInstruction} Keep the summary under ${tokenLimit} words. Use markdown formatting. Do not include preamble — output only the summary.`,
          },
          {
            role: "user",
            content: `Summarize this article:\n\n${trimmedContent}`,
          },
        ];

        setLoadingStage("extracting");
        setLoadingProgress(SUMMARY_LOADING_STAGES.extracting.progress);

        const summary = (await Promise.race([
          chatWithLLM({
            provider: providerType as "openai" | "anthropic" | "ollama" | "openrouter",
            model: model as string | undefined,
            messages,
            maxTokens: Math.max(tokenLimit * 4, 2048),
            apiKey,
            baseUrl,
            temperature: 0.3,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Summarization timed out")), 30000)
          ),
        ])).content;

        setLoadingStage("synthesizing");
        setLoadingProgress(SUMMARY_LOADING_STAGES.synthesizing.progress);
        await new Promise((resolve) => setTimeout(resolve, 200));

        setSummaryText(summary);
        setLoadingStage("complete");
        setLoadingProgress(100);

        // Cache the result (persist only if favorited)
        cacheSummary(
          articleId,
          content,
          summary,
          { length, focus },
          {
            articleTitle: currentItem.item.title,
            articleUrl: currentItem.item.link,
            favorited: currentItem.item.favorite,
          }
        );
      } catch (error) {
        console.error("Failed to summarize:", error);
        toast.error(
          t("queueScroll.failedSummarize"),
          error instanceof Error ? error.message : "Unknown error"
        );
        setSummaryText("");
      } finally {
        setIsSummarizing(false);
      }
    },
    [
      visibleScrollItems,
      renderedIndex,
      isSummarizing,
      toast,
      modernSummaryLength,
      modernSummaryFocus,
      getCachedSummary,
      cacheSummary,
      settings,
    ]
  );

  // Close summary
  const closeSummary = useCallback(() => {
    setShowSummary(false);
    setSummaryText("");
    setDisplayedSummary("");
  }, []);

  // Switch assistant position
  const toggleAssistantPosition = useCallback(() => {
    setAssistantPosition((prev) => (prev === "left" ? "right" : "left"));
  }, []);

  // Panel resize handlers
  const currentWidthRef = useRef(panelWidth);
  currentWidthRef.current = panelWidth; // Keep ref in sync with state

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = currentWidthRef.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta =
        assistantPosition === "right"
          ? resizeStartXRef.current - e.clientX // dragging left increases width
          : e.clientX - resizeStartXRef.current; // dragging right increases width
      const newWidth = Math.max(240, Math.min(600, resizeStartWidthRef.current + delta));
      setPanelWidth(newWidth);
      currentWidthRef.current = newWidth; // Update ref immediately
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Save to localStorage using the ref to ensure we get the latest value
      localStorage.setItem("rss-assistant-width", currentWidthRef.current.toString());
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, assistantPosition]); // removed panelWidth from deps to avoid re-binding

  const currentItem = visibleScrollItems[currentIndex];
  const renderedItem = visibleScrollItems[renderedIndex];

  const progress =
    visibleScrollItems.length > 0 ? ((currentIndex + 1) / visibleScrollItems.length) * 100 : 0;

  if (visibleScrollItems.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-background text-muted-foreground">
        {favoritesOnly ? (
          <Star className="w-16 h-16 mb-4 opacity-50" />
        ) : (
          <Newspaper className="w-16 h-16 mb-4 opacity-50" />
        )}
        <p className="text-lg mb-2">
          {favoritesOnly ? t("queueScroll.noFavoriteArticles") : t("queueScroll.noArticlesYet")}
        </p>
        <p className="text-sm mb-4">
          {favoritesOnly ? t("queueScroll.starToSee") : t("queueScroll.loadArticles")}
        </p>
        {favoritesOnly && (
          <button
            onClick={() => setFavoritesOnly(false)}
            className="px-4 py-2 mb-3 bg-muted text-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            {t("queueScroll.showAll")}
          </button>
        )}
        <button
          onClick={onExit}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          {t("queueScroll.exit")}
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full bg-background overflow-hidden relative">
      {/* Clickable Progress bar */}
      <div
        ref={progressBarRef}
        onClick={handleProgressBarClick}
        className="absolute top-0 left-0 right-0 h-1.5 bg-muted z-50 cursor-pointer hover:h-2 transition-all"
        title="Click to jump to position"
      >
        <div
          className="h-full bg-orange-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
        {/* Progress tooltip on hover */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity text-xs text-muted-foreground bg-background/90 px-2 py-1 rounded pointer-events-none">
          {Math.round(progress)}%
        </div>
      </div>

      {/* Header controls */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-background/90 to-transparent pb-8 pt-4 px-4 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              title="Back to RSS Reader (Esc)"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Rss className="w-5 h-5 text-orange-500" />
              <span className="font-medium text-foreground">
                {visibleScrollItems.length === 0 ? 0 : currentIndex + 1} /{" "}
                {visibleScrollItems.length}
              </span>
              {/* Jump to index button */}
              <button
                onClick={() => setShowJumpInput(true)}
                className="ml-1 p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="Jump to article number (press 'j')"
              >
                <span className="text-xs font-mono">#</span>
              </button>
            </div>
            <button
              onClick={() => setFavoritesOnly((prev) => !prev)}
              className={cn(
                "ml-2 px-2.5 py-1 rounded-md text-xs transition-colors",
                favoritesOnly
                  ? "bg-yellow-500/15 text-yellow-600"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={favoritesOnly ? "Showing favorites only" : "Show favorites only"}
            >
              {favoritesOnly ? t("queueScroll.favorites") : t("queueScroll.allArticles")}
            </button>
            {/* Mark All Read button */}
            {!favoritesOnly && (
              <button
                onClick={() => setShowMarkAllConfirm(true)}
                disabled={isMarkingAllRead}
                className="ml-1 p-1.5 text-muted-foreground hover:text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                title="Mark all as read"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {currentItem && (
            <div className="flex items-center gap-2">
              {/* Summarize button */}
              <button
                onClick={() => { void handleSummarize(); }}
                disabled={isSummarizing}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isSummarizing
                    ? "text-primary animate-pulse"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title="Summarize article with AI"
              >
                <Sparkle className="w-5 h-5" />
              </button>
              {/* Mark as read / Auto-read toggle */}
              <button
                onClick={() => handleMarkRead(currentItem.feed.id, currentItem.item.id, true)}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200 relative",
                  autoReadMode
                    ? "bg-green-500/20 text-green-500 ring-2 ring-green-500/50"
                    : currentItem.item.read ||
                        readItems.has(`${currentItem.feed.id}-${currentItem.item.id}`)
                      ? "text-green-500"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title={autoReadMode ? "Auto-read mode ON - Click to disable" : "Mark as read"}
              >
                <CheckCircle className="w-5 h-5" />
                {autoReadMode && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                )}
              </button>
              <button
                onClick={() =>
                  handleToggleFavoriteAnimated(currentItem.feed.id, currentItem.item.id)
                }
                className={cn(
                  "p-2 rounded-lg transition-all duration-200 relative",
                  currentItem.item.favorite
                    ? "text-yellow-500"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title={currentItem.item.favorite ? "Remove favorite" : "Add to favorites"}
              >
                <Star
                  className={cn(
                    "w-5 h-5 transition-transform duration-300",
                    currentItem.item.favorite && "fill-yellow-500",
                    favoriteAnimation === `${currentItem.feed.id}-${currentItem.item.id}` &&
                      "scale-125"
                  )}
                />
                {currentItem.item.favorite && (
                  <span className="absolute inset-0 rounded-lg ring-2 ring-yellow-500/50 animate-ping opacity-75" />
                )}
              </button>
              {/* Info button for article context */}
              <button
                onClick={() => setShowContextOverlay(true)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  showContextOverlay
                    ? "text-blue-500 bg-blue-100 dark:bg-blue-900/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title="Article info (press 'i')"
              >
                <Info className="w-5 h-5" />
              </button>
              <a
                href={currentItem.item.link}
                onClick={(e) => {
                  e.preventDefault();
                  void handleOpenOriginal(currentItem.item.link);
                }}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="Open original"
              >
                <ArrowSquareOut className="w-5 h-5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="h-full w-full flex items-center justify-center">
        {/* Navigation buttons */}
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0 || isTransitioning}
          className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-background/80 hover:bg-background shadow-lg transition-all",
            currentIndex === 0 && "opacity-0 pointer-events-none",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          <CaretUp className="w-6 h-6" />
        </button>

        <button
          onClick={goToNext}
          disabled={currentIndex >= visibleScrollItems.length - 1 || isTransitioning}
          className={cn(
            "absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-background/80 hover:bg-background shadow-lg transition-all",
            currentIndex >= visibleScrollItems.length - 1 && "opacity-0 pointer-events-none",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          <CaretDown className="w-6 h-6" />
        </button>

        {/* Article content */}
        {renderedItem && (
          <article
            className={cn(
              "h-full w-full max-w-4xl mx-auto overflow-hidden transition-all duration-300",
              isTransitioning ? "opacity-50 scale-[0.98]" : "opacity-100 scale-100"
            )}
          >
            <div className="h-full flex flex-col pt-12 pb-20 px-6">
              {/* Article header */}
              <header className="flex-shrink-0 mb-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    {/* Feed source indicator */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
                        {getFeedIcon(renderedItem.feed) ? (
                          <img
                            src={getFeedIcon(renderedItem.feed)}
                            alt=""
                            className="w-4 h-4 rounded object-cover"
                          />
                        ) : (
                          <Rss className="w-4 h-4 text-orange-500" />
                        )}
                        <span className="text-sm font-medium text-foreground">
                          {renderedItem.feed.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {formatFeedDate(renderedItem.item.pubDate)}
                      </div>
                      {renderedItem.item.author && (
                        <span className="text-sm text-muted-foreground">
                          by {renderedItem.item.author}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                      {renderedItem.item.title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      {renderedItem.item.thumbnail && (
                        <button
                          onClick={() => setIsImageExpanded(!isImageExpanded)}
                          className="flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/40 rounded-lg text-xs transition-colors mobile-density-tap font-medium"
                        >
                          {isImageExpanded ? <EyeSlash className="w-3.5 h-3.5 mr-0.5" /> : <Eye className="w-3.5 h-3.5 mr-0.5" />}
                          {isImageExpanded ? "Hide cover image" : "Show cover image"}
                        </button>
                      )}

                      <button
                        onClick={() => setShowFullContent(!showFullContent)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs transition-all duration-300 font-bold shadow-md cursor-pointer mobile-density-tap",
                          showFullContent
                            ? "bg-blue-600 border-blue-500 text-white shadow-blue-500/20 hover:bg-blue-700"
                            : "bg-blue-500/10 border-blue-500/40 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-400"
                        )}
                        title={showFullContent ? "Show RSS Content" : "View Full Content"}
                      >
                        <TextT className="w-3.5 h-3.5" />
                        {showFullContent ? "Show RSS Content" : "View Full Content"}
                      </button>
                    </div>
                  </div>

                  {!isImageExpanded && renderedItem.item.thumbnail && (
                    <div
                      onClick={() => setIsImageExpanded(true)}
                      className="w-20 h-20 md:w-28 md:h-28 rounded-xl overflow-hidden border border-border/60 bg-muted/30 flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-300 shadow-sm"
                      title="Click to expand cover image"
                    >
                      <img
                        src={renderedItem.item.thumbnail}
                        alt="Cover thumbnail"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>

                {isImageExpanded && renderedItem.item.thumbnail && (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-border/60 bg-muted/30 relative group">
                    <img
                      src={renderedItem.item.thumbnail}
                      alt=""
                      className="h-auto max-h-[28rem] w-full object-cover"
                      loading="lazy"
                    />
                    <button
                      onClick={() => setIsImageExpanded(false)}
                      className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      title="Collapse image"
                    >
                      <EyeSlash className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Summary Badge - shown when summary is available but panel is closed */}
                {renderedItem &&
                  !showSummary &&
                  isCached(
                    `${renderedItem.feed.id}-${renderedItem.item.id}`,
                    renderedItem.item.content || renderedItem.item.description || ""
                  ) && (
                    <SummaryBadge
                      isVisible={true}
                      onClick={() => {
                        const content =
                          renderedItem.item.content || renderedItem.item.description || "";
                        const articleId = `${renderedItem.feed.id}-${renderedItem.item.id}`;
                        const cached = getCachedSummary(articleId, content);
                        if (cached) {
                          setSummaryText(cached.content);
                          setModernSummaryLength(cached.length);
                          setModernSummaryFocus(cached.focus);
                        }
                        setShowSummary(true);
                      }}
                      className="mt-2"
                    />
                  )}

                {/* Categories */}
                {renderedItem.item.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {renderedItem.item.categories.map((cat, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </header>

              {/* Article content */}
              {showFullContent && loadingFullContent.has(renderedItem.item.id) ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
                  <CircleNotch className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm text-muted-foreground animate-pulse">Fetching full article content...</p>
                </div>
              ) : showFullContent && fullContentErrors.has(renderedItem.item.id) ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 space-y-4 px-6 text-center">
                  <WarningCircle className="w-10 h-10 text-red-500 animate-bounce" />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">
                      Failed to load full content
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md">{fullContentErrors.get(renderedItem.item.id)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const itemId = renderedItem.item.id;
                        setFullContentErrors((prev) => {
                          const next = new Map(prev);
                          next.delete(itemId);
                          return next;
                        });
                        setFullContentMap((prev) => {
                          const next = new Map(prev);
                          next.delete(itemId);
                          return next;
                        });
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-xs font-semibold shadow-md shadow-blue-500/10"
                    >
                      <ArrowsClockwise className="w-3.5 h-3.5" />
                      Retry
                    </button>
                    <button
                      onClick={() => void handleOpenOriginal(renderedItem.item.link)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg transition-colors text-xs font-semibold"
                    >
                      <ArrowSquareOut className="w-3.5 h-3.5" />
                      Open Original
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  ref={contentRef}
                  className="flex-1 overflow-y-auto rss-article-content prose prose-lg max-w-none dark:prose-invert select-text"
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    const link = target.closest("a[href]") as HTMLAnchorElement | null;
                    if (!link) return;
                    if (hasActiveSelectionInContent()) return;
                    e.preventDefault();
                    void handleOpenOriginal(link.href);
                  }}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(
                      showFullContent
                        ? cleanArticleHtml(fullContentMap.get(renderedItem.item.id) || renderedItem.item.fullContent || "")
                        : (renderedItem.item.content || renderedItem.item.description || "")
                    ),
                  }}
                />
              )}

              {/* Article footer */}
              <footer className="flex-shrink-0 mt-6 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleToggleFavorite(renderedItem.feed.id, renderedItem.item.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                      renderedItem.item.favorite
                        ? "bg-yellow-500/10 text-yellow-600"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    )}
                  >
                    {renderedItem.item.favorite ? (
                      <Star className="w-4 h-4 fill-yellow-500" />
                    ) : (
                      <Star className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {renderedItem.item.favorite ? "Favorited" : "Favorite"}
                    </span>
                  </button>

                  <a
                    href={renderedItem.item.link}
                    onClick={(e) => {
                      e.preventDefault();
                      void handleOpenOriginal(renderedItem.item.link);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg transition-colors"
                  >
                    <ArrowSquareOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Read Original</span>
                  </a>

                  <button
                    onClick={() => void handleCopyLink(renderedItem.item.link || renderedItem.item.guid)}
                    title={t("rss.copyLink")}
                    className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg transition-colors"
                  >
                    <LinkSimple className="w-4 h-4" />
                    <span className="text-sm font-medium">{t("rss.copyLink")}</span>
                  </button>

                  {/* Training controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void handleQuickTrain("like")}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        trainPulse === "like"
                          ? "text-emerald-500 bg-emerald-500/20 train-pulse-like"
                          : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                      )}
                      title="Show more like this"
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void handleQuickTrain("dislike")}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        trainPulse === "dislike"
                          ? "text-red-500 bg-red-500/20 train-pulse-dislike"
                          : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      )}
                      title="Show less like this"
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowTrainingMenu(true)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        showTrainingMenu
                          ? "text-emerald-500 bg-emerald-500/10"
                          : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                      )}
                      title="Train intelligence"
                    >
                      <GraduationCap className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Next article preview */}
                {currentIndex < visibleScrollItems.length - 1 && (
                  <div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground">
                    <Sparkle className="w-4 h-4" />
                    <span>
                      Up next: {visibleScrollItems[currentIndex + 1]?.item.title.substring(0, 50)}
                      {visibleScrollItems[currentIndex + 1]?.item.title.length > 50 ? "..." : ""}
                    </span>
                  </div>
                )}
              </footer>
            </div>
          </article>
        )}
      </div>

      {/* Training Menu Overlay */}
      {showTrainingMenu && renderedItem && (
        <TrainingMenu
          article={renderedItem.item}
          feedId={renderedItem.feed.id}
          onClose={() => setShowTrainingMenu(false)}
        />
      )}

      {/* Modern Summary Panel */}
      {renderedItem && (
        <ModernSummaryPanel
          isOpen={showSummary}
          content={summaryText}
          mode={modernSummaryMode}
          length={modernSummaryLength}
          focus={modernSummaryFocus}
          position={assistantPosition}
          width={panelWidth}
          isLoading={isSummarizing}
          loadingProgress={loadingProgress}
          loadingStage={SUMMARY_LOADING_STAGES[loadingStage].label}
          onClose={closeSummary}
          onModeChange={setModernSummaryMode}
          onLengthChange={(length) => {
            setModernSummaryLength(length);
            // Regenerate if we have content and params changed
            if (summaryText && !isSummarizing) {
              void handleSummarize({ length, focus: modernSummaryFocus });
            }
          }}
          onFocusChange={(focus) => {
            setModernSummaryFocus(focus);
            // Regenerate if we have content and params changed
            if (summaryText && !isSummarizing) {
              void handleSummarize({ length: modernSummaryLength, focus });
            }
          }}
          onPositionToggle={toggleAssistantPosition}
          onWidthChange={setPanelWidth}
          onRegenerate={() => { void handleSummarize(); }}
          footerActions={
            summaryText ? (
              <SummaryActions
                content={summaryText}
                articleTitle={renderedItem.item.title}
                articleUrl={renderedItem.item.link}
              />
            ) : undefined
          }
        />
      )}

      {/* Legacy Assistant Panel - only shown when in assistant chat mode */}
      {showSummary && summaryMode === "assistant" && isAssistantVisible && (
        <div
          className={cn(
            "fixed top-28 bottom-24 z-10 bg-card border border-border rounded-lg shadow-2xl flex flex-col transition-all duration-300",
            assistantPosition === "left" ? "left-4" : "right-4"
          )}
          style={{ width: `${panelWidth}px` }}
        >
          {/* Resize handle */}
          <div
            className={cn(
              "absolute top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/20 transition-colors group",
              assistantPosition === "left" ? "right-0" : "left-0"
            )}
            onMouseDown={handleResizeStart}
          >
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-1 h-8 bg-border group-hover:bg-primary/50 rounded",
                assistantPosition === "left" ? "right-0" : "left-0"
              )}
            />
          </div>

          <AssistantPanel
            context={assistantContext}
            position={assistantPosition}
            onPositionChange={setAssistantPosition}
            onWidthChange={setPanelWidth}
            appendContextMessages={false}
            className="h-full"
          />
        </div>
      )}

      {/* Bottom control bar */}
      <div
        className={cn(
          "absolute bottom-4 left-4 z-30 flex items-center gap-2 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Summary toggle */}
        <button
          onClick={() => { if (showSummary) closeSummary(); else void handleSummarize(); }}
          disabled={isSummarizing}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm",
            showSummary
              ? "bg-[#ffb000] text-black hover:bg-[#ffb000]/90"
              : "bg-black/70 text-white hover:bg-black/80"
          )}
          title={showSummary ? "Close summary" : "Generate AI summary"}
        >
          <Sparkle className="w-4 h-4" />
          <span>
            {isSummarizing ? "Summarizing..." : showSummary ? "Close Summary" : "Summarize"}
          </span>
        </button>

        {/* Position toggle (only when summary is shown) */}
        {showSummary && (
          <button
            onClick={toggleAssistantPosition}
            className="px-3 py-2 bg-black/70 text-white hover:bg-black/80 rounded-lg transition-colors text-sm"
            title="Move summary panel"
          >
            {assistantPosition === "left" ? "→ Right" : "← Left"}
          </button>
        )}

        {/* Summary mode toggle (only when summary is shown) */}
        {showSummary && (
          <button
            onClick={() => setSummaryMode(summaryMode === "terminal" ? "assistant" : "terminal")}
            className={cn(
              "px-3 py-2 rounded-lg transition-colors text-sm",
              summaryMode === "assistant"
                ? "bg-primary text-primary-foreground"
                : "bg-black/70 text-white hover:bg-black/80"
            )}
            title="Switch summary mode"
          >
            {summaryMode === "assistant" ? "AI Chat" : "Terminal"}
          </button>
        )}
      </div>

      {/* Help text */}
      <div
        className={cn(
          "absolute bottom-4 left-1/2 -translate-x-1/2 z-30 text-xs text-muted-foreground bg-background/80 px-4 py-2 rounded-full transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        ↑↓ arrows to navigate • i for info • j to jump • Mark as read (✓) enables auto-read
      </div>

      {/* Floating Extract Button */}
      {(selectedText || selectedTextRef.current) && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[70] pointer-events-auto">
          <button
            onMouseDown={(e) => {
              // Prevent mousedown from clearing selection
              e.preventDefault();
            }}
            onClick={(e) => {
              if (e.shiftKey) {
                // Shift+click: open full dialog
                handlePrepareExtractForDialog();
              } else {
                handlePrepareExtract();
              }
            }}
            className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 bg-primary text-primary-foreground rounded-lg shadow-lg hover:opacity-90 transition-opacity min-h-[44px] text-sm md:text-base"
            title={t("queueScroll.createExtractFromSelection")}
          >
            <Lightbulb className="w-5 h-5" />
            <span className="font-medium hidden sm:inline">{t("queueScroll.createExtract")}</span>
            <span className="font-medium sm:hidden">{t("queueScroll.createExtractShort")}</span>
          </button>
        </div>
      )}

      {/* Extract Dialog (opened via Shift+click) */}
      {extractDocumentId && (
        <CreateExtractDialog
          documentId={extractDocumentId}
          selectedText={selectedTextRef.current || selectedText}
          isOpen={isExtractDialogOpen}
          onClose={() => {
            setIsExtractDialogOpen(false);
            setSelectedText("");
            selectedTextRef.current = "";
            window.getSelection()?.removeAllRanges();
          }}
          onCreate={handleExtractCreated}
        />
      )}

      {/* Edit Extract Dialog (opened from toast "Edit" action) */}
      {editExtractFromToast && (
        <EditExtractDialog
          extract={editExtractFromToast}
          isOpen={isEditExtractDialogOpen}
          onClose={() => {
            setIsEditExtractDialogOpen(false);
            setEditExtractFromToast(null);
          }}
          onUpdate={() => {
            setIsEditExtractDialogOpen(false);
            setEditExtractFromToast(null);
          }}
        />
      )}

      {/* Jump to Index Dialog */}
      {showJumpInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 w-80 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Jump to Article</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter article number (1-{visibleScrollItems.length})
            </p>
            <input
              type="number"
              min={1}
              max={visibleScrollItems.length}
              value={jumpTargetIndex}
              onChange={(e) => setJumpTargetIndex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJumpToIndex();
                if (e.key === "Escape") {
                  setShowJumpInput(false);
                  setJumpTargetIndex("");
                }
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground mb-4 focus:outline-none focus:ring-2 focus:ring-primary/60"
              placeholder={`1-${visibleScrollItems.length}`}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowJumpInput(false);
                  setJumpTargetIndex("");
                }}
                className="px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJumpToIndex}
                disabled={!jumpTargetIndex}
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Jump
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark All Read Confirmation */}
      {showMarkAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Mark All as Read?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This will mark all{" "}
              {
                visibleScrollItems.filter(
                  (si) =>
                    !si.item.favorite &&
                    !si.item.read &&
                    !readItems.has(`${si.feed.id}-${si.item.id}`)
                ).length
              }{" "}
              unread articles as read. Favorited articles will be preserved.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowMarkAllConfirm(false)}
                className="px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAllRead}
                disabled={isMarkingAllRead}
                className="px-4 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isMarkingAllRead ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Marking...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Mark All Read
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Article Context Overlay */}
      {showContextOverlay && currentItem && (
        <ArticleContextOverlay
          feed={currentItem.feed}
          item={currentItem.item}
          isOpen={showContextOverlay}
          onClose={() => setShowContextOverlay(false)}
          onExpandFullContent={() => setShowFullContent(!showFullContent)}
          onOpenOriginal={() => handleOpenOriginal(currentItem.item.link)}
          hasFullContent={!!currentItem.item.fullContent || !!fullContentMap.get(currentItem.item.id)}
          isFullContentExpanded={showFullContent}
        />
      )}

      {/* ArrowCounterClockwise Toast */}
      {undoState && undoState.visible && (
        <div className={cn("undo-toast", undoState.visible && "visible")}>
          <div
            className={cn(
              "undo-toast-icon",
              undoState.action === "read" ? "mark-read" : "favorite"
            )}
          >
            {undoState.action === "read" ? (
              <CheckCircle className="w-full h-full" />
            ) : (
              <Star className="w-full h-full" />
            )}
          </div>
          <div className="undo-toast-message">
            <span>
              {undoState.action === "read"
                ? "Marked as read"
                : undoState.wasFavorite
                  ? "Unfavorited"
                  : "Favorited"}
            </span>
          </div>
          <button onClick={handleUndo} className="undo-toast-action">
            <ArrowCounterClockwise className="w-4 h-4 mr-1" />
            ArrowCounterClockwise
          </button>
          <div className="undo-toast-progress">
            <div className="undo-toast-progress-bar" style={{ width: `${undoState.progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
