import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useI18n } from "../lib/i18n";
import { useTabsStore, type TabPane } from "../stores/tabsStore";
import { Sparkles, ExternalLink, Info, Lightbulb, MessageSquare, Code, Settings2, FileText, Eye, EyeOff, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useQueueStore } from "../stores/queueStore";
import { useDocumentStore } from "../stores/documentStore";
import { defaultSettings, useSettingsStore } from "../stores/settingsStore";
import { DocumentViewer } from "../components/viewer/DocumentViewer";
import { AudiobookViewer } from "../components/viewer/AudiobookViewer";
import { FlashcardScrollItem } from "../components/review/FlashcardScrollItem";
import { rateDocumentEngaging, getSmartStartPosition } from "../api/algorithm";
import { getDueItems, type LearningItem } from "../api/learning-items";
import { sanitizeHtml } from "../components/common/RichContentRenderer";
import { getDueExtracts, submitExtractReview } from "../api/extract-review";
import { createExtract, deleteExtract, type Extract } from "../api/extracts";
import { ExtractScrollItem } from "../components/review/ExtractScrollItem";
import { ClozeCreatorPopup } from "../components/extracts/ClozeCreatorPopup";
import { QACreatorPopup } from "../components/extracts/QACreatorPopup";
import { CreateExtractDialog } from "../components/extracts/CreateExtractDialog";
import { ExtractsList } from "../components/extracts/ExtractsList";
import { FlashcardStudioModal } from "../components/review/FlashcardStudioModal";
import { LearningCardsList } from "../components/learning/LearningCardsList";
import { submitReview } from "../api/review";
import {
  getUnreadItemsAuto,
  getSubscribedFeedsAuto,
  type FeedItem as RSSFeedItem,
  type Feed as RSSFeed,
  markItemReadAuto,
  toggleItemFavoriteAuto,
  getArticleFullContent,
  fetchArticleFullContent,
} from "../api/rss";
import { cleanArticleHtml } from "../components/media/RSSFullContentView";
import { getEpisodeQueue, markEpisodePlayed, type PodcastEpisode } from "../api/podcast";
import { cn } from "../utils";
import { scoreRssRelevance, type RssClassifier } from "../utils/rssRelevance";
import { useClassifiersStore } from "../stores/classifiersStore";
import { RelevanceIndicator } from "../components/media/RelevanceIndicator";
import { ItemDetailsPopover, type ItemDetailsTarget } from "../components/common/ItemDetailsPopover";
import { AssistantPanel, type AssistantContext, type AssistantPosition } from "../components/assistant/AssistantPanel";
import { useToast } from "../components/common/Toast";
import { getDeviceInfo, isPWA } from "../lib/pwa";
import { RSSQueueSettingsModal } from "../components/settings/RSSQueueSettings";
import { createDocument, updateDocumentContent, dismissDocument } from "../api/documents";
import { trimToTokenWindow } from "../utils/tokenizer";
import { fetchYouTubeTranscript } from "../api/youtube";
import { ReaderTTSControls } from "../components/common/ReaderTTSControls";
import { usePaneId } from "../components/common/Tabs/TabContent";
import { DocumentViewer as DocumentViewerTab } from "../components/tabs/TabRegistry";
import { ScrollQueueSettings } from "../components/queue/ScrollQueueSettings";
import { ScrollOverlayControls } from "../components/queue/ScrollOverlayControls";
import type { ExtractSourceContext } from "../types/extractNavigation";
import { bulkSuspendItems } from "../api/queue";

const buildTranscriptText = (segments: Array<{ text: string }>): string =>
  segments
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const stripHtmlToText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractYouTubeId = (urlOrId: string): string => {
  if (!urlOrId) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern);
    if (match) return match[1];
  }

  return urlOrId;
};

/**
 * Unified scroll item type for documents, RSS articles, and flashcards
 */
interface ScrollItem {
  id: string;
  type: "document" | "rss" | "flashcard" | "extract" | "podcast";
  documentId?: string;
  documentTitle: string;
  rssItem?: RSSFeedItem;
  rssFeed?: RSSFeed;
  podcastEpisode?: PodcastEpisode;
  learningItem?: LearningItem;
  extract?: Extract;
  /** Topic/category for variety mixing */
  category?: string;
  /** Estimated reading time in minutes */
  estimatedTime?: number;
  /** Priority for engagement ordering */
  engagementScore?: number;
  /** RSS relevance score (0.0-1.0) from classifier-based scoring */
  relevanceScore?: number;
}

// Session storage keys for smart resume
const SESSION_KEYS = {
  LAST_POSITION: "scroll-mode-last-position",
  SESSION_TIMESTAMP: "scroll-mode-session-time",
  ITEMS_REVIEWED: "scroll-mode-items-reviewed",
  RATED_IDS: "scroll-mode-rated-ids",
} as const;

/**
 * QueueScrollPage - TikTok-style vertical scrolling through document queue, flashcards, and RSS articles
 *
 * Features:
 * - Full-screen immersive document reading and flashcard review
 * - Mouse wheel scroll navigation (scroll down = next, scroll up = previous)
 * - Smooth transitions between items
 * - Inline rating controls for documents and flashcards
 * - RSS article reading with mark as read
 * - Position indicator
 * - FSRS-6 Engaging algorithm with variety mixing
 * - Smart start position (resumes or varies start for engagement)
 */
export function QueueScrollPage() {
  const { t } = useI18n();
  const { filteredItems: allQueueItems, loadQueue, customSubset } = useQueueStore(useShallow(s => ({
    filteredItems: s.filteredItems,
    loadQueue: s.loadQueue,
    customSubset: s.customSubset,
  })));
  const { documents, loadDocuments, addDocument, updateDocument } = useDocumentStore(useShallow(s => ({
    documents: s.documents,
    loadDocuments: s.loadDocuments,
    addDocument: s.addDocument,
    updateDocument: s.updateDocument,
  })));
  const { rootPane, closeTab, updateTab, addTab } = useTabsStore(useShallow(s => ({
    rootPane: s.rootPane,
    closeTab: s.closeTab,
    updateTab: s.updateTab,
    addTab: s.addTab,
  })));
  const { settings, updateSettingsCategory } = useSettingsStore(useShallow(s => ({
    settings: s.settings,
    updateSettingsCategory: s.updateSettingsCategory,
  })));
  const paneId = usePaneId();

  const activeTabId = useMemo(() => {
    const findFirstTabPane = (pane: typeof rootPane): TabPane | null => {
      if (pane.type === "tabs") return pane;
      if (pane.type === "split") {
        for (const child of pane.children) {
          const found = findFirstTabPane(child);
          if (found) return found;
        }
      }
      return null;
    };
    const firstPane = findFirstTabPane(rootPane);
    return firstPane?.activeTabId ?? null;
  }, [rootPane]);
  const toast = useToast();
  const contextWindowTokens = settings.ai.maxTokens;
  const aiModel = settings.ai.model;

  // Use smart start position instead of always starting at 0
  const [currentIndex, setCurrentIndex] = useState(0);
  const [renderedIndex, setRenderedIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showRssSettings, setShowRssSettings] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(settings.rssQueue.showCoverImage ?? false);

  // Full content states
  const [showFullContent, setShowFullContent] = useState(false);
  const [fullContentMap, setFullContentMap] = useState<Map<string, string>>(new Map());
  const [loadingFullContent, setLoadingFullContent] = useState<Set<string>>(new Set());
  const [fullContentErrors, setFullContentErrors] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setIsImageExpanded(settings.rssQueue.showCoverImage ?? false);
  }, [currentIndex, settings.rssQueue.showCoverImage]);
  const [scrollItems, setScrollItems] = useState<ScrollItem[]>([]);
  const [dueFlashcards, setDueFlashcards] = useState<LearningItem[]>([]);
  const [dueExtracts, setDueExtracts] = useState<Extract[]>([]);
  const [isRating, setIsRating] = useState(false);
  const [ratedDocumentIds, setRatedDocumentIds] = useState<Set<string>>(new Set());
  const [itemsReviewedThisSession, setItemsReviewedThisSession] = useState(0);
  const [, setAssistantInputActive] = useState(false);
  const [assistantPosition, setAssistantPosition] = useState<AssistantPosition>(() => {
    const saved = localStorage.getItem("assistant-panel-position");
    return saved === "left" ? "left" : "right";
  });
  const transcriptCacheRef = useRef<Map<string, string>>(new Map());
  const transcriptFetchInFlightRef = useRef<Set<string>>(new Set());

  const [selectedProvider, setSelectedProvider] = useState<"openai" | "anthropic" | "ollama" | "openrouter">(() => {
    const stored = localStorage.getItem("assistant-llm-provider");
    if (stored === "openai" || stored === "anthropic" || stored === "ollama" || stored === "openrouter") {
      return stored;
    }
    return "openai";
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scrollViewMode, setScrollViewMode] = useState<"document" | "extracts" | "cards">("document");
  const deviceInfo = getDeviceInfo();
  const isMobile = deviceInfo.isMobile || deviceInfo.isTablet;
  const [rssSelectedText, setRssSelectedText] = useState("");
  const MAX_SELECTION_CHARS = 10000;
  // Persist provider selection
  useEffect(() => {
    localStorage.setItem("assistant-llm-provider", selectedProvider);
  }, [selectedProvider]);

  // Reset view mode when scrolling to a new item
  useEffect(() => {
    setScrollViewMode("document");
  }, [currentIndex]);

  const providers = [
    { id: "openai", name: "OpenAI", icon: Sparkles, color: "text-green-500" },
    { id: "anthropic", name: "Anthropic", icon: MessageSquare, color: "text-orange-500" },
    { id: "ollama", name: "Ollama", icon: Code, color: "text-blue-500" },
    { id: "openrouter", name: "OpenRouter", icon: Settings2, color: "text-purple-500" },
  ] as const;

  // Popup state
  const [activeExtractForCloze, setActiveExtractForCloze] = useState<{ id: string, text: string, extractContent?: string, range: [number, number] } | null>(null);
  const [activeExtractForQA, setActiveExtractForQA] = useState<string | null>(null);
  const [isExtractDialogOpen, setIsExtractDialogOpen] = useState(false);
  const [flashcardStudioSeed, setFlashcardStudioSeed] = useState<{ key: string; documentId?: string | null; excerpt?: string; draftCardType?: "qa" | "cloze" | null; resetDraftCards?: boolean; autoEditDraft?: boolean; extractId?: string } | null>(null);

  const lastScrollTime = useRef(0);
  const scrollCooldown = 500; // ms between scroll actions
  const startTimeRef = useRef(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const rssContentRef = useRef<HTMLDivElement>(null);

  // Mobile PWA text selection state for RSS items
  const [mobileRssSelection, setMobileRssSelection] = useState<{
    text: string;
    position: { x: number; y: number };
    showButton: boolean;
  }>({ text: "", position: { x: 0, y: 0 }, showButton: false });
  const mobileRssSelectionTimeoutRef = useRef<number | null>(null);
  const isMobilePWA = isPWA() && (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);

  const buildQueueExtractSourceContext = useCallback((params: {
    documentId: string;
    title: string;
    sourceKind: ExtractSourceContext["sourceKind"];
  }): ExtractSourceContext => ({
    documentId: params.documentId,
    sourceTitle: params.title,
    sourceKind: params.sourceKind,
    queueType: "queue-scroll",
  }), []);

  const openExtractInDocumentTab = useCallback((params: {
    documentId: string;
    documentTitle: string;
    extract: Extract;
    sourceContext: ExtractSourceContext;
  }) => {
    addTab({
      title: params.documentTitle,
      icon: <FileText className="w-4 h-4 text-muted-foreground" />,
      type: "document-viewer",
      content: DocumentViewerTab,
      closable: true,
      data: {
        documentId: params.documentId,
        initialViewMode: "extracts",
        focusedExtractId: params.extract.id,
        extractSourceContext: params.sourceContext,
      },
    }, paneId);
  }, [addTab, paneId]);

  useEffect(() => {
    const savedRatedIds = sessionStorage.getItem(SESSION_KEYS.RATED_IDS);
    if (savedRatedIds) {
      try {
        setRatedDocumentIds(new Set(JSON.parse(savedRatedIds)));
      } catch {
        // ignore parse errors
      }
    }

    const savedItemsReviewed = sessionStorage.getItem(SESSION_KEYS.ITEMS_REVIEWED);
    if (savedItemsReviewed) {
      setItemsReviewedThisSession(parseInt(savedItemsReviewed, 10) || 0);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEYS.RATED_IDS, JSON.stringify(Array.from(ratedDocumentIds)));
  }, [ratedDocumentIds]);

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEYS.ITEMS_REVIEWED, String(itemsReviewedThisSession));
  }, [itemsReviewedThisSession]);

  const handleExtractUpdate = useCallback((extractId: string, updates: { content: string; notes?: string }) => {
    setScrollItems(prev => prev.map((item) => (
      item.type === "extract" && item.extract?.id === extractId
        ? { ...item, extract: { ...item.extract, content: updates.content, notes: updates.notes, date_modified: new Date().toISOString() } }
        : item
    )));
  }, []);

  const updateRssSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!text) {
      setRssSelectedText("");
      return;
    }

    const container = rssContentRef.current;
    const anchorNode = selection?.anchorNode ?? null;
    const focusNode = selection?.focusNode ?? null;
    const selectionInContainer = !!container
      && ((anchorNode && container.contains(anchorNode)) || (focusNode && container.contains(focusNode)));
    if (!selectionInContainer) {
      setRssSelectedText("");
      return;
    }

    if (text.length > MAX_SELECTION_CHARS) {
      setRssSelectedText("");
      return;
    }

    setRssSelectedText(text);
  }, [MAX_SELECTION_CHARS]);

  // Filter documents
  // When a custom semantic cluster is active, use those items as the base queue instead
  const documentQueueItems = useMemo(() => {
    const baseItems = customSubset ?? allQueueItems;
    return baseItems.filter((item) => {
      if (item.itemType !== "document") return false;

      // Skip recently rated documents to prevent them from reappearing immediately
      if (ratedDocumentIds.has(item.documentId)) return false;

      const doc = documents.find(d => d.id === item.documentId);

      // Skip if document not loaded yet (shouldn't happen after loadDocuments() awaits)
      if (!doc) return false;

      // Skip dismissed documents (they remain in database and searchable)
      if (doc.isDismissed) return false;

      return true;
    });
  }, [allQueueItems, customSubset, documents, ratedDocumentIds]);

  // Smart start position calculation
  const calculateSmartStart = useCallback(async (totalItems: number) => {
    if (totalItems === 0) return { position: 0, shouldShowToast: false, lastPosition: 0 };

    const lastPositionStr = sessionStorage.getItem(SESSION_KEYS.LAST_POSITION);
    const lastPosition = lastPositionStr ? parseInt(lastPositionStr, 10) : undefined;

    try {
      const response = await getSmartStartPosition({
        total_items: totalItems,
        last_session_position: lastPosition,
        items_reviewed_this_session: itemsReviewedThisSession,
        // Use timestamp as seed for reproducible variety
        seed: Date.now(),
      });

      return {
        position: response.start_position,
        shouldShowToast: response.is_resuming && lastPosition !== undefined && lastPosition > 0,
        lastPosition: lastPosition ?? 0,
      };
    } catch (error) {
      console.error("Failed to get smart start position:", error);
      return { position: 0, shouldShowToast: false, lastPosition: 0 };
    }
  }, [itemsReviewedThisSession]);

  // IMPORTANT: Await loadDocuments() to prevent race condition in YouTube filter
  // Now uses smart start position for variety
  useEffect(() => {
    const loadAllData = async () => {
      startTimeRef.current = Date.now();

      // This ensures the YouTube filter has all documents loaded before computing
      await loadDocuments();

      await loadQueue();

      try {
        const [dueItems, extracts] = await Promise.all([
          getDueItems(),
          getDueExtracts()
        ]);
        setDueFlashcards(dueItems);
        setDueExtracts(extracts);
      } catch (error) {
        console.error("Failed to load review items:", error);
      }
    };
    loadAllData();
  }, []); // Only run on mount

  // Apply smart start position once items are loaded
  useEffect(() => {
    if (scrollItems.length > 0 && currentIndex === 0) {
      calculateSmartStart(scrollItems.length).then(result => {
        const { position: startPos, shouldShowToast, lastPosition } = result;
        if (startPos > 0) {
          setCurrentIndex(startPos);
          setRenderedIndex(startPos);

          if (activeTabId) {
            updateTab(activeTabId, {
              data: {
                currentIndex: startPos,
                renderedIndex: startPos,
                sessionTimestamp: Date.now(),
              },
            });
          }

          // Only show toast when position is actually applied
          if (shouldShowToast) {
            toast.info(t("queueScroll.resuming"), t("queueScroll.resumingPosition", { position: lastPosition + 1, total: scrollItems.length }));
          }
        }
      });
    }
  }, [scrollItems.length, currentIndex, calculateSmartStart, activeTabId, updateTab, toast]);

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEYS.LAST_POSITION, String(currentIndex));

    if (activeTabId) {
      updateTab(activeTabId, {
        data: {
          currentIndex,
          renderedIndex,
        },
      });
    }
  }, [currentIndex, renderedIndex, activeTabId, updateTab]);

  // Load/fetch full content for the active RSS item in the queue
  useEffect(() => {
    const currentItem = scrollItems[currentIndex];
    if (!currentItem || currentItem.type !== "rss" || !showFullContent || !currentItem.rssItem) return;

    const item = currentItem.rssItem;
    const itemId = item.id;
    const itemLink = item.link;

    // 1. Already in memory map
    if (fullContentMap.has(itemId)) return;

    // 2. Already in object
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
              si.type === "rss" && si.rssItem?.id === itemId
                ? {
                    ...si,
                    rssItem: {
                      ...si.rssItem,
                      fullContent: cached.content,
                      fullContentFetchedAt: cached.fetchedAt,
                    } as any,
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
                si.type === "rss" && si.rssItem?.id === itemId
                  ? {
                      ...si,
                      rssItem: {
                        ...si.rssItem,
                        fullContent: result.fullContent,
                        fullContentFetchedAt: result.fetchedAt,
                      } as any,
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
  }, [currentIndex, showFullContent, scrollItems]);

  /**
   * Apply engagement-based variety mixing to the queue
   * 
   * This ensures:
   * - Topic variety (don't cluster same categories)
   * - Length variety (mix long and short items)
   * - Discovery injection (surface new items)
   */
  const applyVarietyMixing = useCallback((items: ScrollItem[]): ScrollItem[] => {
    if (items.length <= 3) return items;

    const maxSameCategory = 3; // Max consecutive items from same category
    const result: ScrollItem[] = [];
    const categoryCounts: Map<string, number> = new Map();

    // Sort items by engagement score (higher = more priority)
    const sorted = [...items].sort((a, b) =>
      (b.engagementScore ?? 0) - (a.engagementScore ?? 0)
    );

    for (const item of sorted) {
      const category = item.category ?? "uncategorized";
      const currentCount = categoryCounts.get(category) ?? 0;

      if (currentCount < maxSameCategory) {
        result.push(item);
        categoryCounts.set(category, currentCount + 1);
      } else {
        // Find a position later in the result where we can insert this
        // without violating the category constraint
        let inserted = false;
        for (let i = result.length - 1; i >= 0; i--) {
          const itemAtPos = result[i];
          const catAtPos = itemAtPos.category ?? "uncategorized";
          if (catAtPos !== category) {
            let consecutiveSame = 0;
            for (let j = i; j < result.length && consecutiveSame < maxSameCategory; j++) {
              if ((result[j]?.category ?? "uncategorized") === category) {
                consecutiveSame++;
              } else {
                break;
              }
            }
            if (consecutiveSame < maxSameCategory) {
              result.splice(i + 1, 0, item);
              inserted = true;
              break;
            }
          }
        }

        if (!inserted) {
          // Add to end anyway - better to show it than lose it
          result.push(item);
        }
      }
    }

    return result;
  }, []);

  // Helper to generate deterministic "random" value from string (0-1 range)
  // This ensures stable scores across renders while still providing variety
  const getStableRandom = useCallback((str: string, offset: number = 0): number => {
    let hash = 0;
    const combined = str + offset;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }, []);

  // Interleave: Due flashcards first, then documents, then RSS
  // Skip during rating to prevent race conditions
  useEffect(() => {
    if (isRating) return;
    let cancelled = false;

    const buildScrollItems = async () => {
      // When a custom semantic cluster is active, filter flashcards/extracts to only those
      // belonging to documents in the subset
      const subsetDocIds = customSubset
        ? new Set(customSubset.map(item => item.documentId))
        : null;
      const activeFlashcards = subsetDocIds
        ? dueFlashcards.filter(item => subsetDocIds.has(item.document_id))
        : dueFlashcards;
      const activeExtracts = subsetDocIds
        ? dueExtracts.filter(ex => subsetDocIds.has(ex.document_id))
        : dueExtracts;

      const flashcardItems: ScrollItem[] = activeFlashcards.map((item) => ({
        id: `flashcard-${item.id}`,
        type: "flashcard" as const,
        documentTitle: item.question.substring(0, 50) + (item.question.length > 50 ? "..." : ""),
        learningItem: item,
        category: item.tags?.[0] ?? "flashcards",
        estimatedTime: 2, // Flashcards are quick
        // Use stable random based on item ID to prevent re-render loops
        engagementScore: 5 + getStableRandom(item.id, 1) * 2,
      }));

      const docItems: ScrollItem[] = documentQueueItems
        .map((item) => {
          const doc = documents.find(d => d.id === item.documentId);
          if (doc?.isArchived) {
            return null;
          }
          // Calculate engagement score based on priority and variety factors
          const isNew = !doc?.dateLastReviewed;
          const priority = item.priority ?? 5;
          const recencyBoost = isNew ? 2 : 0;
          const baseScore = priority + recencyBoost;
          // Add stable "randomness" for serendipity (0-1.5 bonus)
          const serendipityBonus = getStableRandom(item.id, 2) * 1.5;

          return {
            id: item.id,
            type: "document" as const,
            documentId: item.documentId,
            documentTitle: item.documentTitle,
            category: doc?.category ?? item.tags?.[0] ?? "uncategorized",
            estimatedTime: item.estimatedTime ?? 10,
            engagementScore: baseScore + serendipityBonus,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null) as ScrollItem[];

      const rssSettings = settings.rssQueue ?? defaultSettings.rssQueue;
      let rssItems: ScrollItem[] = [];

      if (customSubset) {
        // If customSubset is active, we bypass settings and ONLY load RSS items explicitly selected in the cluster!
        const rssSubsets = customSubset.filter(item => item.itemType === "rss-article" as any);
        rssItems = rssSubsets.map(item => {
          const rssItem = (item as any).rssItem as RSSFeedItem;
          const rssFeed = (item as any).rssFeed as RSSFeed;
          return {
            id: item.id,
            type: "rss" as const,
            documentTitle: item.documentTitle,
            rssItem,
            rssFeed,
            category: rssFeed?.category ?? "rss",
            estimatedTime: 5,
            engagementScore: 10, // Max priority for custom subset items
          };
        }).filter(item => !!item.rssItem);
      } else if (rssSettings.includeInQueue) {
        // Get items based on unread setting
        let rssItemsToProcess: { feed: RSSFeed; item: RSSFeedItem }[];
        if (rssSettings.unreadOnly) {
          rssItemsToProcess = await getUnreadItemsAuto();
        } else {
          const allFeeds = await getSubscribedFeedsAuto();
          rssItemsToProcess = allFeeds.flatMap(feed =>
            feed.items.map(item => ({ feed, item }))
          );
        }

        // Filter by feed inclusion/exclusion
        const filteredRssItems = rssItemsToProcess.filter(({ feed, item }) => {
          if (rssSettings.excludedFeedIds.includes(feed.id)) return false;

          // Check if feed is explicitly included (if inclusion list is not empty)
          if (rssSettings.includedFeedIds.length > 0) {
            return rssSettings.includedFeedIds.includes(feed.id);
          }

          if (rssSettings.maxItemAgeDays > 0) {
            const publishedAt = Date.parse(item.pubDate);
            if (!Number.isNaN(publishedAt)) {
              const maxAgeMs = rssSettings.maxItemAgeDays * 24 * 60 * 60 * 1000;
              if (Date.now() - publishedAt > maxAgeMs) {
                return false;
              }
            }
          }

          return true;
        });

        // Sort by date if preferRecent is enabled
        if (rssSettings.preferRecent) {
          filteredRssItems.sort((a, b) =>
            new Date(b.item.pubDate).getTime() - new Date(a.item.pubDate).getTime()
          );
        }

        // Limit items per session
        const limitedRssItems = rssSettings.maxItemsPerSession > 0
          ? filteredRssItems.slice(0, rssSettings.maxItemsPerSession)
          : filteredRssItems;

        // Score RSS items for relevance using classifiers
        const classifiers = useClassifiersStore.getState().classifiers;
        const hasClassifiers = classifiers.length > 0;

        rssItems = limitedRssItems.map(({ feed, item }) => {
          let relevanceScore: number | undefined;
          let engagementScore: number;

          if (hasClassifiers) {
            relevanceScore = scoreRssRelevance(
              {
                itemTitle: item.title,
                itemAuthor: item.author,
                itemTags: item.categories ?? [],
                feedId: feed.id,
                feedTitle: feed.title,
                pubDate: item.pubDate,
              },
              classifiers.map((c): RssClassifier => ({
                classifier_type: c.classifier_type,
                value: c.value,
                sentiment: c.sentiment,
                scope: c.scope,
                feed_id: c.feed_id,
              })),
            );
            // Scale relevance 0-1 to engagementScore 0-10
            engagementScore = relevanceScore * 10;
          } else {
            engagementScore = 4 + getStableRandom(item.id, 3);
          }

          return {
            id: `rss-${item.id}`,
            type: "rss",
            documentTitle: item.title,
            rssItem: item,
            rssFeed: feed,
            category: feed.category ?? "rss",
            estimatedTime: 5,
            engagementScore,
            relevanceScore,
          };
        });

        // Sort RSS items by relevance (highest first) — unless preferRecent is
        // enabled, in which case we keep the chronological order from above.
        if (!rssSettings.preferRecent && hasClassifiers) {
          rssItems.sort((a, b) => (b.relevanceScore ?? 0.5) - (a.relevanceScore ?? 0.5));
        } else if (rssSettings.preferRecent && hasClassifiers) {
          // Within the chronological grouping, sort by relevance as tiebreaker
          rssItems.sort((a, b) => {
            const dateDiff = new Date(b.rssItem!.pubDate).getTime() - new Date(a.rssItem!.pubDate).getTime();
            if (Math.abs(dateDiff) > 0) return dateDiff > 0 ? 1 : -1;
            return (b.relevanceScore ?? 0.5) - (a.relevanceScore ?? 0.5);
          });
        }
      }

      let podcastItems: ScrollItem[] = [];
      const podcastSettings = settings.podcastQueue ?? defaultSettings.podcastQueue;
      if (podcastSettings.includeInQueue) {
        try {
          const episodes = await getEpisodeQueue();
          // Filter to unplayed if unreadOnly is enabled
          const filteredEpisodes = podcastSettings.unreadOnly
            ? episodes.filter((ep) => !ep.played)
            : episodes;

          // Limit to maxItemsPerSession
          const limitedEpisodes = podcastSettings.maxItemsPerSession > 0
            ? filteredEpisodes.slice(0, podcastSettings.maxItemsPerSession)
            : filteredEpisodes;

          podcastItems = limitedEpisodes.map((ep) => ({
            id: `podcast-${ep.id}`,
            type: "podcast" as const,
            documentTitle: ep.title,
            podcastEpisode: ep,
            category: "podcast",
            estimatedTime: ep.duration ? Math.ceil(ep.duration / 60) : 30,
            engagementScore: 5 + getStableRandom(ep.id, 5) * 2,
          }));
        } catch (error) {
          console.warn("[QueueScroll] Failed to load podcast episodes for queue:", error);
        }
      }

      const extractItems: ScrollItem[] = activeExtracts.map((extract) => {
        // Find document title
        const doc = documents.find(d => d.id === extract.document_id);
        const title = doc ? doc.title : t("queueScroll.unknownDocument");

        return {
          id: `extract-${extract.id}`,
          type: "extract" as const,
          documentTitle: title,
          extract: extract,
          category: extract.category ?? doc?.category ?? "extracts",
          estimatedTime: 3,
          // Use stable random based on extract ID
          engagementScore: 5 + getStableRandom(extract.id, 4) * 1.5,
        };
      });

      // Separate review items into flashcards and extracts
      // Flashcards: recall-based spaced repetition (controlled by flashcardPercentage)
      // Extracts: incremental reading items (always included, distributed independently)
      const flashcardPercentage = settings.scrollQueue.flashcardPercentage;
      const nonReviewItems = [...docItems, ...rssItems, ...podcastItems];
      const totalNonReview = nonReviewItems.length;

      // Calculate target flashcard count based on percentage setting
      let targetFlashcardCount = 0;
      if (flashcardPercentage < 100 && flashcardPercentage > 0) {
        targetFlashcardCount = Math.round((flashcardPercentage * totalNonReview) / (100 - flashcardPercentage));
      } else if (flashcardPercentage >= 100) {
        targetFlashcardCount = flashcardItems.length;
      }

      // Limit flashcards to available count
      const limitedFlashcards = flashcardItems.slice(0, targetFlashcardCount);

      // Extracts are always included — they don't compete with flashcards
      // but are capped per session to avoid overwhelming the queue
      const maxExtractsPerSession = 20;
      const limitedExtracts = extractItems.slice(0, maxExtractsPerSession);

      // Distribute all item types evenly throughout the queue with variety mixing
      const distributedItems: ScrollItem[] = [];

      if (nonReviewItems.length > 0) {
        // Combine flashcards and extracts for interspersion
        const allReviewItems = [...limitedFlashcards, ...limitedExtracts];
        const interval = allReviewItems.length > 0
          ? Math.max(1, Math.round(nonReviewItems.length / allReviewItems.length))
          : nonReviewItems.length;

        let reviewIndex = 0;
        for (let i = 0; i < nonReviewItems.length; i++) {
          distributedItems.push(nonReviewItems[i]);

          // Insert a review item after every 'interval' non-review items
          if (reviewIndex < allReviewItems.length && (i + 1) % interval === 0) {
            distributedItems.push(allReviewItems[reviewIndex]);
            reviewIndex++;
          }
        }

        // Add any remaining review items at the end
        while (reviewIndex < allReviewItems.length) {
          distributedItems.push(allReviewItems[reviewIndex]);
          reviewIndex++;
        }
      } else if (limitedFlashcards.length > 0 || limitedExtracts.length > 0) {
        // Only review items (no documents/RSS/podcasts)
        distributedItems.push(...limitedFlashcards, ...limitedExtracts);
      } else {
        // Only non-review items
        distributedItems.push(...nonReviewItems);
      }

      // Apply variety mixing for engagement
      const mixedItems = applyVarietyMixing(distributedItems);

      if (!cancelled) {
        setScrollItems(mixedItems);
      }
    };

    void buildScrollItems();
    return () => {
      cancelled = true;
    };
  }, [documentQueueItems, documents, dueFlashcards, dueExtracts, isRating, settings.scrollQueue, settings.rssQueue, settings.podcastQueue, applyVarietyMixing]);

  // Current item (for display during transition)
  const currentItem = scrollItems[currentIndex];
  const currentDocument = useMemo(() => {
    if (!currentItem || currentItem.type !== "document" || !currentItem.documentId) return null;
    return documents.find((doc) => doc.id === currentItem.documentId) ?? null;
  }, [currentItem, documents]);
  const isNewDocument =
    currentDocument
      ? (currentDocument.reps ?? currentDocument.readingCount ?? 0) <= 0
      && !currentDocument.dateLastReviewed
      : false;

  // Rendered item (actual document being rendered)
  const renderedItem = scrollItems[renderedIndex];

  useEffect(() => {
    if (!renderedItem || renderedItem.type !== "rss") {
      setRssSelectedText("");
      return;
    }

    const handleSelection = () => updateRssSelection();
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
    };
  }, [renderedItem, updateRssSelection]);

  useEffect(() => {
    setRssSelectedText("");
    setMobileRssSelection({ text: "", position: { x: 0, y: 0 }, showButton: false });
  }, [renderedItem?.id]);

  // Mobile PWA: Handle text selection for RSS content
  useEffect(() => {
    if (!isMobilePWA) return;
    if (renderedItem?.type !== "rss") return;

    let rafId: number | null = null;

    const handleSelectionChange = () => {
      // Cancel any pending RAF to avoid multiple updates
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (!selection) {
          setMobileRssSelection(prev => ({ ...prev, showButton: false }));
          return;
        }

        const text = selection.toString().trim();

        const anchorElement = selection.anchorNode instanceof Element
          ? selection.anchorNode
          : selection.anchorNode?.parentElement;
        const focusElement = selection.focusNode instanceof Element
          ? selection.focusNode
          : selection.focusNode?.parentElement;

        const container = rssContentRef.current;
        const isInRssContent = container &&
          ((anchorElement && container.contains(anchorElement)) ||
            (focusElement && container.contains(focusElement)));

        if (!text || text.length === 0 || !isInRssContent) {
          setMobileRssSelection(prev => ({ ...prev, showButton: false }));
          return;
        }

        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          // Position the button centered above the selection
          const x = rect.left + rect.width / 2;
          const y = rect.top - 60; // 60px above selection

          setMobileRssSelection({
            text,
            position: { x, y },
            showButton: true,
          });

          // Also update the regular RSS selection state
          setRssSelectedText(text);

          // Auto-hide after 5 seconds if not interacted with
          if (mobileRssSelectionTimeoutRef.current) {
            clearTimeout(mobileRssSelectionTimeoutRef.current);
          }
          mobileRssSelectionTimeoutRef.current = window.setTimeout(() => {
            setMobileRssSelection(prev => ({ ...prev, showButton: false }));
          }, 5000);
        } catch {
          // Range might be invalid, ignore
        }
      });
    };

    // Also handle touchend for immediate response on mobile
    const handleTouchEnd = () => {
      // Small delay to allow selection to be finalized, then use RAF
      setTimeout(handleSelectionChange, 100);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("touchend", handleTouchEnd);
      if (mobileRssSelectionTimeoutRef.current) {
        clearTimeout(mobileRssSelectionTimeoutRef.current);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isMobilePWA, renderedItem?.type]);

  const detailsTarget = useMemo<ItemDetailsTarget | null>(() => {
    if (!currentItem) return null;

    if (currentItem.type === "document" && currentItem.documentId) {
      const doc = documents.find(d => d.id === currentItem.documentId);
      return {
        type: "document",
        id: currentItem.documentId,
        title: currentItem.documentTitle,
        tags: doc?.tags,
        category: doc?.category,
      };
    }

    if (currentItem.type === "flashcard" && currentItem.learningItem) {
      return {
        type: "learning-item",
        id: currentItem.learningItem.id,
        title: currentItem.documentTitle,
        tags: currentItem.learningItem.tags,
      };
    }

    if (currentItem.type === "extract" && currentItem.extract) {
      return {
        type: "extract",
        id: currentItem.extract.id,
        title: currentItem.documentTitle,
        tags: currentItem.extract.tags,
        category: currentItem.extract.category,
      };
    }

    if (currentItem.type === "rss") {
      return {
        type: "rss",
        title: currentItem.documentTitle,
        source: currentItem.rssFeed?.title,
        link: currentItem.rssItem?.link,
      };
    }

    return null;
  }, [currentItem, documents]);

  const [assistantContext, setAssistantContext] = useState<AssistantContext | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const assistantItem = renderedItem ?? currentItem;
    if (!assistantItem) {
      setAssistantContext(undefined);
      return;
    }

    const buildContext = async () => {
      const maxTokens = contextWindowTokens && contextWindowTokens > 0 ? contextWindowTokens : 2000;

      if (assistantItem.type === "document" && assistantItem.documentId) {
        const doc = documents.find(d => d.id === assistantItem.documentId);
        const title = doc?.title || assistantItem.documentTitle;
        const titleLine = title ? `Title: ${title}` : null;

        if (doc?.fileType === "youtube") {
          let transcriptText = transcriptCacheRef.current.get(doc.id);
          if (!transcriptText && !transcriptFetchInFlightRef.current.has(doc.id)) {
            transcriptFetchInFlightRef.current.add(doc.id);
            try {
              const videoId = extractYouTubeId(doc.filePath);
              if (videoId) {
                const segments = await fetchYouTubeTranscript(videoId);
                if (segments.length > 0) {
                  const text = buildTranscriptText(segments);
                  if (text) {
                    transcriptCacheRef.current.set(doc.id, text);
                    transcriptText = text;
                  }
                }
              }
            } catch (error) {
              console.warn("[QueueScroll] Failed to fetch YouTube transcript for assistant context", doc.id, error);
            } finally {
              transcriptFetchInFlightRef.current.delete(doc.id);
            }
          }

          if (transcriptText) {
            const content = [titleLine, transcriptText].filter(Boolean).join("\n\n");
            const trimmed = content ? await trimToTokenWindow(content, maxTokens, aiModel) : undefined;
            if (!cancelled) {
              setAssistantContext({
                type: "video",
                documentId: assistantItem.documentId,
                content: trimmed || undefined,
                contextWindowTokens: maxTokens,
                metadata: {
                  title: title || undefined,
                },
              });
            }
            return;
          }
        }

        const content = [titleLine, doc?.content]
          .filter(Boolean)
          .join("\n\n");
        const trimmed = content ? await trimToTokenWindow(content, maxTokens, aiModel) : undefined;
        if (!cancelled) {
          setAssistantContext({
            type: "document",
            documentId: assistantItem.documentId,
            content: trimmed || undefined,
            contextWindowTokens: maxTokens,
            metadata: {
              title: title || undefined,
            },
          });
        }
        return;
      }

      if (assistantItem.type === "extract" && assistantItem.extract) {
        const extractContent = [assistantItem.extract.content, assistantItem.extract.notes]
          .filter(Boolean)
          .join("\n\n");
        const title = assistantItem.documentTitle ? `Title: ${assistantItem.documentTitle}` : null;
        const content = [title, extractContent].filter(Boolean).join("\n\n");
        const trimmed = content ? await trimToTokenWindow(content, maxTokens, aiModel) : undefined;
        if (!cancelled) {
          setAssistantContext({
            type: "document",
            documentId: `extract:${assistantItem.extract.id}`,
            content: trimmed || undefined,
            contextWindowTokens: maxTokens,
            metadata: {
              title: assistantItem.documentTitle || undefined,
            },
          });
        }
        return;
      }

      if (assistantItem.type === "rss") {
        const title = assistantItem.rssItem?.title ? `Title: ${assistantItem.rssItem?.title}` : null;
        const rssContent = assistantItem.rssItem?.content || assistantItem.rssItem?.description;
        const content = [title, rssContent].filter(Boolean).join("\n\n");
        const trimmed = content ? await trimToTokenWindow(content, maxTokens, aiModel) : undefined;
        if (!cancelled) {
          setAssistantContext({
            type: "web",
            url: assistantItem.rssItem?.link || `rss:${assistantItem.rssItem?.id}`,
            content: trimmed || undefined,
            contextWindowTokens: maxTokens,
            metadata: {
              title: assistantItem.rssItem?.title || undefined,
            },
          });
        }
        return;
      }

      setAssistantContext(undefined);
    };

    void buildContext();
    return () => {
      cancelled = true;
    };
  }, [currentItem, renderedItem, documents, contextWindowTokens, aiModel]);

  useEffect(() => {
    if (currentItem) {
      if (currentItem.type === "document") {
        const _docInStore = documents.find(d => d.id === currentItem.documentId);
      } else {
      }
    }
  }, [currentIndex, currentItem, scrollItems.length, documents]);

  // Navigation functions
  const goToNext = useCallback(() => {
    if (currentIndex < scrollItems.length - 1 && !isTransitioning && !isRating) {
      setIsTransitioning(true);
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      startTimeRef.current = Date.now();
      // Update renderedIndex after transition completes to avoid premature unmount
      setTimeout(() => {
        setRenderedIndex(nextIndex);
        setIsTransitioning(false);
      }, 300);
    }
  }, [currentIndex, scrollItems.length, isTransitioning, isRating]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0 && !isTransitioning && !isRating) {
      setIsTransitioning(true);
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      startTimeRef.current = Date.now();
      // Update renderedIndex after transition completes to avoid premature unmount
      setTimeout(() => {
        setRenderedIndex(prevIndex);
        setIsTransitioning(false);
      }, 300);
    }
  }, [currentIndex, isTransitioning, isRating]);

  const advanceAfterRemoval = useCallback((removedItemId: string) => {
    setScrollItems((prev) => {
      const updated = prev.filter((item) => item.id !== removedItemId);
      if (updated.length === 0) {
        setCurrentIndex(0);
        setRenderedIndex(0);
        return updated;
      }

      const nextIndex = Math.min(currentIndex, updated.length - 1);
      setIsTransitioning(true);
      setCurrentIndex(nextIndex);
      startTimeRef.current = Date.now();
      setTimeout(() => {
        setRenderedIndex(nextIndex);
        setIsTransitioning(false);
      }, 300);
      return updated;
    });
  }, [currentIndex]);

  // Mouse wheel scroll detection - only navigate when document can't scroll further
  // For EPUB documents, disable auto-advance to allow user to read through the entire book
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();

      if (now - lastScrollTime.current < scrollCooldown) {
        return;
      }

      // EPUBs and PDFs can be lengthy documents, so we don't want to auto-advance when user reaches the end
      // Audio documents need the player to remain visible — wheel events shouldn't navigate away
      // User should be able to scroll through the entire document freely
      let isScrollableDocument = false;
      let isYouTubeItem = false;
      if (currentItem?.type === "document" && currentItem.documentId) {
        const doc = documents.find(d => d.id === currentItem.documentId);
        if (doc) {
          const fileType = doc.fileType || doc.filePath?.split('.').pop()?.toLowerCase();
          isScrollableDocument = fileType === "epub" || fileType === "pdf" || fileType === "audio";
          isYouTubeItem = fileType === "youtube"
            || !!doc.filePath?.includes("youtube.com")
            || !!doc.filePath?.includes("youtu.be");
        }
      }

      // For EPUB, PDF, audio documents, and extract review items, don't auto-advance on scroll
      // User must explicitly rate or use keyboard navigation to move to next item
      if (isScrollableDocument || currentItem?.type === "podcast" || currentItem?.type === "extract") {
        return; // Let the document/player/extract scroll normally, no auto-advance
      }

      // Find the scrollable content element
      const target = e.target as HTMLElement;
      if (target.closest(".assistant-panel")) {
        return;
      }
      const transcriptScrollElement = target.closest('[data-transcript-scroll="true"]') as HTMLElement | null;
      const extractScrollContainer = target.closest('[data-extract-scroll="true"]') as HTMLElement | null;
      // For textareas inside extract cards, the textarea itself handles scrolling
      // internally — the parent overflow container never scrolls, so we must check
      // the textarea's scroll position instead of the container's.
      const extractScrollElement = (target.tagName === 'TEXTAREA' && extractScrollContainer)
        ? (target as HTMLElement)
        : extractScrollContainer;
      const scrollableElement = transcriptScrollElement
        || extractScrollElement
        || target.closest('[class*="overflow"]') as HTMLElement
        || target.closest('.prose') as HTMLElement
        || document.documentElement;

      if (scrollableElement) {
        const canScrollDown = scrollableElement.scrollTop < (scrollableElement.scrollHeight - scrollableElement.clientHeight - 10);
        const canScrollUp = scrollableElement.scrollTop > 10;

        if (!(isYouTubeItem && !transcriptScrollElement)) {
          // If scrolling down and document can still scroll down, let it scroll
          if (e.deltaY > 0 && canScrollDown) {
            return; // Let the document scroll normally
          }
          // If scrolling up and document can still scroll up, let it scroll
          if (e.deltaY < 0 && canScrollUp) {
            return; // Let the document scroll normally
          }
        }
      }

      // Document is at edge, navigate to next/previous
      lastScrollTime.current = now;

      // Scroll down = next document
      if (e.deltaY > 0) {
        goToNext();
      }
      // Scroll up = previous document
      else if (e.deltaY < 0) {
        goToPrevious();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: true });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [goToNext, goToPrevious, currentItem, documents]);

  const toggleFullscreen = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow();
      if (isFullscreen) {
        await appWindow.setFullscreen(false);
        setIsFullscreen(false);
      } else {
        await appWindow.setFullscreen(true);
        setIsFullscreen(true);
      }
    } catch (error) {
      console.error("Failed to toggle fullscreen:", error);
    }
  }, [isFullscreen]);

  // Keyboard navigation for TikTok-style scroll mode:
  // Up/Down navigates queue items, Left/Right scrolls item content vertically.
  useEffect(() => {
    const getScrollableContentElement = (): HTMLElement | null => {
      if (!containerRef.current) return null;

      // Prefer transcript panel when present (YouTube items).
      const transcriptEl = containerRef.current.querySelector('[data-transcript-scroll="true"]') as HTMLElement | null;
      if (transcriptEl) {
        return transcriptEl;
      }

      // RSS item container (outer overflow wrapper around the reading surface).
      const rssScrollable = rssContentRef.current?.parentElement as HTMLElement | null;
      if (rssScrollable && rssScrollable.scrollHeight > rssScrollable.clientHeight + 4) {
        return rssScrollable;
      }

      // Document viewer's explicit scroll container (PDF and some other viewers).
      const docScrollContainer = containerRef.current.querySelector('[data-document-scroll-container]') as HTMLElement | null;
      if (docScrollContainer) {
        return docScrollContainer;
      }

      // Fallback: document content host.
      const docContentHost = containerRef.current.querySelector('[data-document-content="true"]') as HTMLElement | null;
      if (docContentHost && docContentHost.scrollHeight > docContentHost.clientHeight + 4) {
        return docContentHost;
      }

      return null;
    };

    const scrollContentVertically = (direction: "up" | "down") => {
      const scrollable = getScrollableContentElement();
      if (!scrollable) return;

      const delta = direction === "down" ? 180 : -180;
      scrollable.scrollBy({ top: delta, behavior: "smooth" });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (target?.closest(".assistant-panel")) {
        return;
      }

      const isReviewItem = currentItem?.type === "flashcard" || currentItem?.type === "extract";

      if (e.key === " ") {
        if (isReviewItem) {
          return;
        }
        e.preventDefault();
        goToNext();
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollContentVertically("down");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollContentVertically("up");
      } else if (e.key === "F11") {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleFullscreen();
      } else if (e.key === "Escape") {
        // Don't close the tab if an overlay (modal/popup/dialog) is open —
        // let the overlay's own handler consume the Escape instead.
        const overlayOpen = !!(flashcardStudioSeed || activeExtractForCloze || activeExtractForQA || isExtractDialogOpen || showSettings || showRssSettings);
        if (overlayOpen) {
          // Don't stop propagation — let the modal/popup handle Escape at bubble phase
          return;
        }
        e.stopImmediatePropagation();
        if (isFullscreen) {
          toggleFullscreen();
          return;
        }
        // Exit scroll mode — close tab and return to previous tab
        if (activeTabId) {
          closeTab(activeTabId);
        }
      } else if (e.key === "h" || e.key === "?") {
        // Toggle controls
        setShowControls((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [currentItem?.type, goToNext, goToPrevious, isFullscreen, toggleFullscreen, activeTabId, closeTab]);

  // Auto-hide controls on mouse idle
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

  // Handle rating (for documents, flashcards, or mark as read for RSS)
  const handleRating = async (rating: number) => {

    if (!currentItem) {
      return;
    }

    if (isRating) {
      return;
    }

    setIsRating(true);
    const ratedItemId = currentItem.id;

    try {
      const timeTaken = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));

      if (currentItem.type === "document") {
        if (!currentItem.documentId) {
          console.error("[QueueScroll] Document item has no documentId!");
          throw new Error("Document ID is missing");
        }

        // Use the engaging FSRS-6 scheduler!
        const result = await rateDocumentEngaging(currentItem.documentId, rating, timeTaken);

        // Track rated document to prevent immediate re-appearance
        setRatedDocumentIds(prev => {
          const newSet = new Set(prev);
          newSet.add(currentItem.documentId!);
          return newSet;
        });

        // Track items reviewed this session
        setItemsReviewedThisSession(prev => prev + 1);

        advanceAfterRemoval(ratedItemId);
        void loadQueue();
      } else if (currentItem.type === "flashcard" && currentItem.learningItem) {
        // Rate flashcard using FSRS
        await submitReview(currentItem.learningItem.id, rating, timeTaken);

        // Track items reviewed
        setItemsReviewedThisSession(prev => prev + 1);

        // Remove the rated flashcard from both dueFlashcards and scrollItems
        setDueFlashcards(prev => prev.filter(item => item.id !== currentItem.learningItem!.id));
        advanceAfterRemoval(ratedItemId);
      } else if (currentItem.type === "rss" && currentItem.rssItem && currentItem.rssFeed) {
        // Mark RSS item as read
        await markItemReadAuto(currentItem.rssFeed.id, currentItem.rssItem.id, true);

        // Track items reviewed
        setItemsReviewedThisSession(prev => prev + 1);

        // Reload RSS items to update the list
        const rssUnread = await getUnreadItemsAuto();
        const rssItems: ScrollItem[] = rssUnread.map(({ feed, item }) => ({
          id: `rss-${item.id}`,
          type: "rss",
          documentTitle: item.title,
          rssItem: item,
          rssFeed: feed,
        }));
        const docItems = scrollItems.filter(item => item.type === "document");
        const flashcardItems = scrollItems.filter(item => item.type === "flashcard");
        const extractItems = scrollItems.filter(item => item.type === "extract");
        const nextItems = [...flashcardItems, ...extractItems, ...docItems, ...rssItems];
        setScrollItems(nextItems);
        if (nextItems.length === 0) {
          setCurrentIndex(0);
          setRenderedIndex(0);
        } else {
          const nextIndex = Math.min(currentIndex, nextItems.length - 1);
          setIsTransitioning(true);
          setCurrentIndex(nextIndex);
          startTimeRef.current = Date.now();
          setTimeout(() => {
            setRenderedIndex(nextIndex);
            setIsTransitioning(false);
          }, 300);
        }
      } else if (currentItem.type === "extract" && currentItem.extract) {
        await submitExtractReview(currentItem.extract.id, rating, timeTaken);

        // Track items reviewed
        setItemsReviewedThisSession(prev => prev + 1);

        setDueExtracts(prev => prev.filter(e => e.id !== currentItem.extract!.id));
        advanceAfterRemoval(ratedItemId);
      } else if (currentItem.type === "podcast" && currentItem.podcastEpisode) {
        // Mark podcast episode as played
        await markEpisodePlayed(currentItem.podcastEpisode.id, true);

        // Track items reviewed
        setItemsReviewedThisSession(prev => prev + 1);

        advanceAfterRemoval(ratedItemId);
      }

      // Allow transition to complete, then release rating lock
      setTimeout(() => {
        setIsRating(false);
      }, 300);
    } catch (error) {
      console.error("[QueueScroll] Failed to handle rating:", error);
      toast.error(
        t("queueScroll.ratingFailed"),
        error instanceof Error ? error.message : t("queueScroll.pleaseTryAgain")
      );
    } finally {
      // Always reset isRating after a short delay, even on error
      setTimeout(() => {
        setIsRating(false);
      }, 500);
    }
  };

  const handleDismiss = async () => {

    if (!currentItem) {
      return;
    }

    if (isRating) {
      return;
    }

    // Supported types for dismissal: document, flashcard, extract
    if (
      currentItem.type !== "document" &&
      currentItem.type !== "flashcard" &&
      currentItem.type !== "extract"
    ) {
      toast.info(t("queueScroll.dismissNotAvailable"), t("queueScroll.onlyDismissableItems") !== "queueScroll.onlyDismissableItems" ? t("queueScroll.onlyDismissableItems") : "Only documents, flashcards, and extracts can be dismissed");
      return;
    }

    setIsRating(true);
    const dismissedItemId = currentItem.id;

    try {
      if (currentItem.type === "document" && currentItem.documentId) {

        // Call API to dismiss document
        await dismissDocument(currentItem.documentId, true);

        // Track dismissed document
        setRatedDocumentIds((prev) => {
          const newSet = new Set(prev);
          newSet.add(currentItem.documentId!);
          return newSet;
        });

        // Track items reviewed this session
        setItemsReviewedThisSession((prev) => prev + 1);

        toast.success(t("queueScroll.documentDismissed"), t("queueScroll.documentDismissedDesc"));
      } else if (currentItem.type === "flashcard" && currentItem.learningItem) {
        const cardId = currentItem.learningItem.id;

        // Call API to suspend flashcard
        await bulkSuspendItems([cardId]);

        // Track items reviewed this session
        setItemsReviewedThisSession((prev) => prev + 1);

        // Remove from dueFlashcards state to prevent re-populating on state recalculation
        setDueFlashcards((prev) => prev.filter((item) => item.id !== cardId));

        toast.success(
          t("queueScroll.cardSuspended") !== "queueScroll.cardSuspended" ? t("queueScroll.cardSuspended") : "Flashcard suspended",
          t("queueScroll.cardSuspendedDesc") !== "queueScroll.cardSuspendedDesc" ? t("queueScroll.cardSuspendedDesc") : "This flashcard has been suspended and will not appear in reviews."
        );
      } else if (currentItem.type === "extract" && currentItem.extract) {
        const extractId = currentItem.extract.id;

        // Call API to delete extract
        await deleteExtract(extractId);

        // Track items reviewed this session
        setItemsReviewedThisSession((prev) => prev + 1);

        // Remove from dueExtracts state to prevent re-populating on state recalculation
        setDueExtracts((prev) => prev.filter((e) => e.id !== extractId));

        toast.success(
          t("queueScroll.extractDeleted") !== "queueScroll.extractDeleted" ? t("queueScroll.extractDeleted") : "Extract deleted",
          t("queueScroll.extractDeletedDesc") !== "queueScroll.extractDeletedDesc" ? t("queueScroll.extractDeletedDesc") : "This extract has been deleted successfully."
        );
      }

      advanceAfterRemoval(dismissedItemId);
      void loadQueue();
    } catch (error) {
      console.error(`[QueueScroll] Failed to dismiss ${currentItem.type}:`, error);
      toast.error(
        t("queueScroll.dismissFailed"),
        error instanceof Error ? error.message : t("queueScroll.pleaseTryAgain")
      );
    } finally {
      setTimeout(() => {
        setIsRating(false);
      }, 500);
    }
  };

  const handleRssToggleFavorite = useCallback(async (feedId: string, itemId: string) => {
    try {
      await toggleItemFavoriteAuto(feedId, itemId);
    } catch (error) {
      console.warn("Failed to toggle RSS favorite:", error);
    }
    setScrollItems((prev) =>
      prev.map((item) =>
        item.type === "rss" && item.rssFeed?.id === feedId && item.rssItem?.id === itemId
          ? { ...item, rssItem: { ...item.rssItem!, favorite: !item.rssItem?.favorite } }
          : item
      )
    );
  }, []);

  // Touch gesture handlers for swipe actions and vertical navigation (matches RSS scroll mode gestures)
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

    const handleTouchEnd = (e: TouchEvent) => {
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

      const target = e.target as HTMLElement;
      if (target.closest(".assistant-panel")) return;

      let isScrollableDocument = false;
      let isYouTubeItem = false;
      if (currentItem?.type === "document" && currentItem.documentId) {
        const doc = documents.find(d => d.id === currentItem.documentId);
        if (doc) {
          const fileType = doc.fileType || doc.filePath?.split('.').pop()?.toLowerCase();
          isScrollableDocument = fileType === "epub" || fileType === "pdf" || fileType === "audio";
          isYouTubeItem = fileType === "youtube"
            || !!doc.filePath?.includes("youtube.com")
            || !!doc.filePath?.includes("youtu.be");
        }
      }

      if (absDeltaX > absDeltaY) {
        if (absDeltaX > minSwipeDistance && velocity > minVelocity) {
          if (currentItem?.type === "rss" && currentItem.rssFeed && currentItem.rssItem) {
            // Swipe right = mark as read, Swipe left = favorite
            if (deltaX > 0) {
              void handleRating(1);
            } else if (deltaX < 0) {
              void handleRssToggleFavorite(currentItem.rssFeed.id, currentItem.rssItem.id);
            }
          }
        }
      } else {
        // Vertical gesture - check for navigation
        if (absDeltaY > minSwipeDistance && velocity > minVelocity) {
          if (isScrollableDocument || currentItem?.type === "podcast" || currentItem?.type === "extract") {
            return;
          }

          const transcriptScrollElement = target.closest('[data-transcript-scroll="true"]') as HTMLElement | null;
          const extractScrollContainer = target.closest('[data-extract-scroll="true"]') as HTMLElement | null;
          const extractScrollElement = (target.tagName === 'TEXTAREA' && extractScrollContainer)
            ? (target as HTMLElement)
            : extractScrollContainer;
          const scrollableElement = transcriptScrollElement
            || extractScrollElement
            || target.closest('[class*="overflow"]') as HTMLElement
            || target.closest('.prose') as HTMLElement
            || document.documentElement;

          if (scrollableElement) {
            const canScrollDown = scrollableElement.scrollTop < (scrollableElement.scrollHeight - scrollableElement.clientHeight - 10);
            const canScrollUp = scrollableElement.scrollTop > 10;

            if (!(isYouTubeItem && !transcriptScrollElement)) {
              if (deltaY < 0 && canScrollDown) return;
              if (deltaY > 0 && canScrollUp) return;
            }
          }

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
  }, [currentItem, documents, goToNext, goToPrevious, handleRating, handleRssToggleFavorite]);

  const handleCreateRssExtract = useCallback(async () => {
    if (!renderedItem || renderedItem.type !== "rss" || !renderedItem.rssItem) return;

    const selectionText = rssSelectedText.trim();
    if (!selectionText) return;

    const rssItem = renderedItem.rssItem;
    const rssContent = rssItem.content || rssItem.description || "";
    const rssLink = rssItem.link || `rss:${rssItem.id}`;
    const existingDoc = documents.find((doc) => doc.filePath === rssLink);
    let documentId = existingDoc?.id;

    try {
      if (!documentId) {
        const created = await createDocument(
          rssItem.title || renderedItem.documentTitle,
          rssLink,
          "html"
        );
        addDocument(created);
        documentId = created.id;
      }

      if (rssContent && documentId) {
        await updateDocumentContent(documentId, rssContent);
        updateDocument(documentId, {
          content: rssContent,
          title: rssItem.title || renderedItem.documentTitle,
          filePath: rssLink,
          fileType: "html",
        });
      }

      let createdExtract: Extract | null = null;
      if (documentId) {
        createdExtract = await createExtract({ document_id: documentId, content: selectionText });
      }

      const sourceContext = documentId
        ? buildQueueExtractSourceContext({
            documentId,
            title: rssItem.title || renderedItem.documentTitle,
            sourceKind: "article",
          })
        : null;

      toast.success(
        t("queueScroll.extractCreated"),
        t("queueScroll.savedFromRSS"),
        createdExtract && sourceContext
          ? {
              action: {
                label: "View extract",
                onClick: () => openExtractInDocumentTab({
                  documentId,
                  documentTitle: rssItem.title || renderedItem.documentTitle,
                  extract: createdExtract,
                  sourceContext,
                }),
              },
            }
          : undefined
      );
      setRssSelectedText("");
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error("Failed to create extract from RSS item:", error);
      toast.error(
        t("queueScroll.failedCreateExtract"),
        error instanceof Error ? error.message : t("queueScroll.anErrorOccurred")
      );
    }
  }, [renderedItem, rssSelectedText, documents, addDocument, updateDocument, toast, buildQueueExtractSourceContext, openExtractInDocumentTab]);

  // Mobile PWA: Handle extract creation from mobile RSS selection
  const handleMobileRssExtract = useCallback(async () => {
    if (!mobileRssSelection.text) return;

    // Set the RSS selected text state temporarily
    setRssSelectedText(mobileRssSelection.text);

    // Hide the mobile button
    setMobileRssSelection(prev => ({ ...prev, showButton: false }));
    if (mobileRssSelectionTimeoutRef.current) {
      clearTimeout(mobileRssSelectionTimeoutRef.current);
    }

    // Call the regular handler
    await handleCreateRssExtract();
  }, [mobileRssSelection.text, handleCreateRssExtract]);

  const handleExit = () => {
    if (activeTabId) {
      closeTab(activeTabId);
    }
  };

  if (!currentItem) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">{t("queueScroll.nothingToRead")}</h2>
          <p className="text-muted-foreground">
            {t("queueScroll.nothingToReadDesc")}
          </p>
          <button
            onClick={handleExit}
            className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            {t("queueScroll.backToQueue")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden bg-background relative"
    >
      {/* Content Viewer - Document, Flashcard, or RSS Article */}
      <div
        className="flex h-full min-h-0 w-full overflow-hidden"
        onClick={(e) => {
          // Toggle controls on click/tap if not clicking interactive elements
          if (isMobile && !(e.target as HTMLElement).closest('button, input, textarea, a, .interactive')) {
            setShowControls(prev => !prev);
          }
        }}
      >
        {!isMobile && renderedItem && renderedItem.type !== "flashcard" && assistantPosition === "left" && (
          <>
            {/* Model Chooser - Above Assistant */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2 p-2 border-r border-border bg-card z-10">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id as any)}
                  className={`p-2 rounded-lg transition-all ${selectedProvider === provider.id
                    ? "bg-muted ring-2 ring-primary"
                    : "hover:bg-muted"
                    }`}
                  title={provider.name}
                >
                  <provider.icon className={`w-5 h-5 ${provider.color}`} />
                </button>
              ))}
            </div>
            <div className="flex-shrink-0 h-full min-h-0 z-10">
              <AssistantPanel
                context={assistantContext}
                className="assistant-panel h-full"
                onInputHoverChange={setAssistantInputActive}
                appendContextMessages={false}
                position={assistantPosition}
                onPositionChange={(newPosition) => {
                  setAssistantPosition(newPosition);
                  localStorage.setItem("assistant-panel-position", newPosition);
                }}
                selectedProvider={selectedProvider}
                onProviderChange={setSelectedProvider}
              />
            </div>
          </>
        )}
        <div
          className={cn(
            "h-full min-h-0 flex-1 min-w-0 overflow-hidden transition-opacity duration-300 relative",
            isTransitioning ? "opacity-0" : "opacity-100"
          )}
        >
          {renderedItem?.type === "document" && scrollViewMode !== "document" ? (
            scrollViewMode === "extracts" ? (
              <ExtractsList documentId={renderedItem.documentId!} />
            ) : (
              <LearningCardsList documentId={renderedItem.documentId!} />
            )
          ) : renderedItem?.type === "document" ? (() => {
            const doc = documents.find(d => d.id === renderedItem.documentId);
            return (
              <DocumentViewer
                key={renderedItem.documentId}
                documentId={renderedItem.documentId!}
                embedded={true}
                hideRatingOrbs={true}
                extractPostCreateBehavior="stay-in-reader"
                onExtractCreated={(extract, sourceContext) => {
                  const effectiveContext = sourceContext ?? buildQueueExtractSourceContext({
                    documentId: renderedItem.documentId!,
                    title: renderedItem.documentTitle,
                    sourceKind: doc?.fileType === "html" || doc?.metadata?.source === "browser_extension" ? "article" : "book",
                  });
                  toast.success(t("queueScroll.extractCreated"), t("queueScroll.savedInScrollMode"), {
                    action: {
                      label: "View extract",
                      onClick: () => openExtractInDocumentTab({
                        documentId: renderedItem.documentId!,
                        documentTitle: renderedItem.documentTitle,
                        extract,
                        sourceContext: effectiveContext,
                      }),
                    },
                  });
                }}
              />
            );
          })() : renderedItem?.type === "flashcard" && renderedItem.learningItem ? (
            <FlashcardScrollItem
              key={renderedItem.learningItem.id}
              learningItem={renderedItem.learningItem}
              onRate={handleRating}
              onCreateFlashcard={(excerpt, extractId, documentId) => setFlashcardStudioSeed({
                key: `scroll-${extractId || renderedItem.learningItem!.id}-${Date.now()}`,
                excerpt,
                draftCardType: "qa",
                resetDraftCards: true,
                autoEditDraft: false,
                extractId,
                documentId,
              })}
              onCreateCloze={(text, range) => {
                if (renderedItem.learningItem?.extract_id) {
                  setActiveExtractForCloze({
                    id: renderedItem.learningItem.extract_id,
                    text,
                    extractContent: renderedItem.learningItem.question,
                    range
                  });
                }
              }}
              onCreateQA={() => {
                if (renderedItem.learningItem?.extract_id) {
                  setActiveExtractForQA(renderedItem.learningItem.extract_id);
                }
              }}
            />
          ) : renderedItem?.type === "rss" ? (
            <div className="h-full w-full overflow-y-auto">
              <div ref={rssContentRef} className="max-w-3xl mx-auto px-8 py-12 reading-surface">
                {/* RSS Article Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 reading-meta">
                      <span className="px-2 py-1 bg-orange-500/10 text-orange-500 rounded-md text-xs font-medium">
                        {t("queueScroll.rss")}
                      </span>
                      <span>{renderedItem.rssFeed?.title}</span>
                    </div>
                    <h1 className="text-3xl font-bold text-foreground mb-3 reading-title flex items-center gap-2">
                      {renderedItem.rssItem?.title}
                      <RelevanceIndicator score={renderedItem.relevanceScore} className="mt-1.5" />
                    </h1>
                    <div className="flex items-center flex-wrap gap-4 text-sm text-muted-foreground reading-meta">
                      {renderedItem.rssItem?.pubDate && (
                        <span>{new Date(renderedItem.rssItem.pubDate).toLocaleDateString()}</span>
                      )}
                      {renderedItem.rssItem?.author && <span>• {renderedItem.rssItem.author}</span>}
                      <a
                        href={renderedItem.rssItem?.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-foreground transition-colors mobile-density-tap"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {t("queueScroll.openOriginal")}
                      </a>
                      {renderedItem.rssItem?.thumbnail && (
                        <button
                          onClick={() => setIsImageExpanded(!isImageExpanded)}
                          className="flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/40 rounded-lg text-xs transition-colors mobile-density-tap"
                        >
                          {isImageExpanded ? <EyeOff className="w-3.5 h-3.5 mr-0.5" /> : <Eye className="w-3.5 h-3.5 mr-0.5" />}
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
                        <FileText className="w-3.5 h-3.5 mr-0.5" />
                        {showFullContent ? "Show RSS Content" : "View Full Content"}
                      </button>
                    </div>
                  </div>

                  {!isImageExpanded && renderedItem.rssItem?.thumbnail && (
                    <div
                      onClick={() => setIsImageExpanded(true)}
                      className="w-20 h-20 md:w-28 md:h-28 rounded-xl overflow-hidden border border-border/60 bg-muted/30 flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-300 shadow-sm"
                      title="Click to expand cover image"
                    >
                      <img
                        src={renderedItem.rssItem.thumbnail}
                        alt="Cover thumbnail"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>

                {isImageExpanded && renderedItem.rssItem?.thumbnail && (
                  <div className="mb-8 overflow-hidden rounded-2xl border border-border/60 bg-muted/30 relative group">
                    <img
                      src={renderedItem.rssItem.thumbnail}
                      alt=""
                      className="h-auto max-h-[32rem] w-full object-cover"
                      loading="lazy"
                    />
                    <button
                      onClick={() => setIsImageExpanded(false)}
                      className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      title="Collapse image"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* RSS Article Content */}
                {showFullContent && loadingFullContent.has(renderedItem.rssItem.id) ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-sm text-muted-foreground animate-pulse">Fetching full article content...</p>
                  </div>
                ) : showFullContent && fullContentErrors.has(renderedItem.rssItem.id) ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-4 px-6 text-center">
                    <AlertCircle className="w-10 h-10 text-red-500 animate-bounce" />
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        Failed to load full content
                      </p>
                      <p className="text-xs text-muted-foreground max-w-md">{fullContentErrors.get(renderedItem.rssItem.id)}</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => {
                          const itemId = renderedItem.rssItem!.id;
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
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry
                      </button>
                      <button
                        onClick={() => {
                          if (renderedItem.rssItem?.link) {
                            window.open(renderedItem.rssItem.link, "_blank", "noopener,noreferrer");
                          }
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg transition-colors text-xs font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Original
                      </button>
                    </div>
                  </div>
                ) : (renderedItem.rssItem?.content || renderedItem.rssItem?.description || (showFullContent && fullContentMap.get(renderedItem.rssItem.id))) ? (
                  <div
                    className="prose prose-lg max-w-none text-foreground reading-prose"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(
                        showFullContent
                          ? cleanArticleHtml(fullContentMap.get(renderedItem.rssItem.id) || renderedItem.rssItem.fullContent || "")
                          : (renderedItem.rssItem.content || renderedItem.rssItem.description || "")
                      )
                    }}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>{t("queueScroll.noArticleContent")}</p>
                    <a
                      href={renderedItem.rssItem?.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-4 text-primary hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t("queueScroll.readOnOriginalSite")}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : renderedItem?.type === "podcast" && renderedItem.podcastEpisode ? (
            <AudiobookViewer
              key={renderedItem.podcastEpisode.id}
              document={{
                id: renderedItem.podcastEpisode.id,
                title: renderedItem.podcastEpisode.title,
                filePath: "",
                fileType: "audio",
                coverImageUrl: renderedItem.podcastEpisode.imageUrl || undefined,
                content: "",
                metadata: {},
                createdAt: renderedItem.podcastEpisode.publishedDate
                  ? new Date(renderedItem.podcastEpisode.publishedDate).toISOString()
                  : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              } as any}
              remoteAudioUrl={renderedItem.podcastEpisode.audioUrl}
              episodeId={renderedItem.podcastEpisode.id}
              episodeTitle={renderedItem.podcastEpisode.title}
              onEpisodeEnded={() => {
                // Mark as played and remove from queue
                if (renderedItem.podcastEpisode) {
                  void markEpisodePlayed(renderedItem.podcastEpisode.id, true);
                }
                setItemsReviewedThisSession(prev => prev + 1);
                advanceAfterRemoval(renderedItem.id);
              }}
            />
          ) : renderedItem?.type === "extract" && renderedItem.extract ? (
            <ExtractScrollItem
              key={renderedItem.extract.id}
              extract={renderedItem.extract}
              documentTitle={renderedItem.documentTitle}
              onRate={handleRating}
              onCreateCloze={(text, range) => setActiveExtractForCloze({ id: renderedItem.extract!.id, text, extractContent: renderedItem.extract!.content, range })}
              onCreateQA={() => setActiveExtractForQA(renderedItem.extract!.id)}
              onCreateFlashcard={(_selectedText) => setFlashcardStudioSeed({
                key: `scroll-${renderedItem.extract!.id}-${Date.now()}`,
                excerpt: renderedItem.extract!.content,
                draftCardType: "qa",
                resetDraftCards: true,
                autoEditDraft: false,
                extractId: renderedItem.extract!.id,
              })}
              onUpdate={(updates) => handleExtractUpdate(renderedItem.extract!.id, updates)}
            />
          ) : (
            // Fallback for no item
            <div className="h-full flex items-center justify-center">
              <div className="text-muted-foreground">{t("common.loading")}</div>
            </div>
          )}

          {renderedItem?.type === "rss" && (
            <ReaderTTSControls
              text={stripHtmlToText(
                showFullContent
                  ? (fullContentMap.get(renderedItem.rssItem?.id || "") || renderedItem.rssItem?.fullContent || renderedItem.rssItem?.content || renderedItem.rssItem?.description || "")
                  : (renderedItem.rssItem?.content || renderedItem.rssItem?.description || "")
              )}
              className={cn(
                "absolute z-40 bottom-3 left-3 right-3",
                !isMobile && "left-1/2 right-auto -translate-x-1/2"
              )}
            />
          )}
        </div>
        {!isMobile && renderedItem && renderedItem.type !== "flashcard" && assistantPosition === "right" && (
          <>
            <div className="flex-shrink-0 h-full min-h-0 z-10">
              <AssistantPanel
                context={assistantContext}
                className="assistant-panel h-full"
                onInputHoverChange={setAssistantInputActive}
                appendContextMessages={false}
                position={assistantPosition}
                onPositionChange={(newPosition) => {
                  setAssistantPosition(newPosition);
                  localStorage.setItem("assistant-panel-position", newPosition);
                }}
                selectedProvider={selectedProvider}
                onProviderChange={setSelectedProvider}
              />
            </div>
            {/* Model Chooser - Above Assistant */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2 p-2 border-l border-border bg-card z-10">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id as any)}
                  className={`p-2 rounded-lg transition-all ${selectedProvider === provider.id
                    ? "bg-muted ring-2 ring-primary"
                    : "hover:bg-muted"
                    }`}
                  title={provider.name}
                >
                  <provider.icon className={`w-5 h-5 ${provider.color}`} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Popups */}
      {activeExtractForCloze && (
        <ClozeCreatorPopup
          extractId={activeExtractForCloze.id}
          selectedText={activeExtractForCloze.text}
          extractContent={activeExtractForCloze.extractContent}
          selectionRange={activeExtractForCloze.range}
          onCreated={(item) => {
            setActiveExtractForCloze(null);
            setDueFlashcards(prev => [item, ...prev]);
          }}
          onCancel={() => setActiveExtractForCloze(null)}
        />
      )}

      {activeExtractForQA && (
        <QACreatorPopup
          extractId={activeExtractForQA}
          onCreated={(item) => {
            setActiveExtractForQA(null);
            setDueFlashcards(prev => [item, ...prev]);
          }}
          onCancel={() => setActiveExtractForQA(null)}
        />
      )}

      {/* Create Extract Dialog for document items in scroll mode */}
      {renderedItem?.type === "document" && renderedItem.documentId && (
        <CreateExtractDialog
          documentId={renderedItem.documentId}
          isOpen={isExtractDialogOpen}
          onClose={() => setIsExtractDialogOpen(false)}
          onCreate={(extract) => {
            setIsExtractDialogOpen(false);
            const sourceContext = buildQueueExtractSourceContext({
              documentId: renderedItem.documentId!,
              title: renderedItem.documentTitle,
              sourceKind: "book",
            });
            toast.success(t("queueScroll.extractCreated"), t("queueScroll.savedInScrollMode"), {
              action: {
                label: "View extract",
                onClick: () => openExtractInDocumentTab({
                  documentId: renderedItem.documentId!,
                  documentTitle: renderedItem.documentTitle,
                  extract,
                  sourceContext,
                }),
              },
            });
          }}
        />
      )}

      {/* Flashcard Studio Modal from right-click context menu */}
      <FlashcardStudioModal
        isOpen={!!flashcardStudioSeed}
        onClose={() => setFlashcardStudioSeed(null)}
        seed={flashcardStudioSeed}
      />

      {/* RSS Extract Action */}
      {renderedItem?.type === "rss" && rssSelectedText && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[70] pointer-events-auto">
          <button
            onClick={handleCreateRssExtract}
            className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 bg-primary text-primary-foreground rounded-lg shadow-lg hover:opacity-90 transition-opacity min-h-[44px] text-sm md:text-base"
            title={t("queueScroll.createExtractFromSelection")}
          >
            <Lightbulb className="w-5 h-5" />
            <span className="font-medium hidden sm:inline">{t("queueScroll.createExtract")}</span>
            <span className="font-medium sm:hidden">{t("queueScroll.createExtractShort")}</span>
          </button>
        </div>
      )}

      {/* Mobile PWA: Lightbulb button for RSS text selection */}
      {isMobilePWA && renderedItem?.type === "rss" && mobileRssSelection.showButton && (
        <div
          className="fixed z-[80] pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
          style={{
            left: `${mobileRssSelection.position.x}px`,
            top: `${Math.max(60, mobileRssSelection.position.y)}px`,
            transform: "translateX(-50%)",
          }}
          data-extract-button="true"
        >
          <button
            onClick={handleMobileRssExtract}
            className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-xl hover:opacity-90 hover:scale-110 active:scale-95 transition-all"
            title={t("queueScroll.createExtractFromSelection")}
            aria-label={`Create extract from selected text (${mobileRssSelection.text.length} characters)`}
          >
            <Lightbulb className="w-6 h-6" aria-hidden="true" />
          </button>
          {/* Small arrow pointing down to the selection */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary" />
        </div>
      )}

      {/* Scroll Queue Settings Panel */}
      <ScrollQueueSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        flashcardPercentage={settings.scrollQueue.flashcardPercentage}
        extractsCountAsFlashcards={settings.scrollQueue.extractsCountAsFlashcards}
        onUpdateSetting={(key, value) => updateSettingsCategory('scrollQueue', { [key]: value })}
      />

      {/* Overlay Controls */}
      <ScrollOverlayControls
        showControls={showControls}
        currentIndex={currentIndex}
        totalItems={scrollItems.length}
        sessionOffset={itemsReviewedThisSession}
        itemType={currentItem?.type ?? "document"}
        itemTitle={currentItem?.documentTitle ?? ""}
        itemDocumentId={currentItem?.documentId}
        isNewDocument={isNewDocument}
        isRating={isRating}
        scrollViewMode={scrollViewMode}
        helpText={currentItem?.type === "document" ? (() => {
          const doc = documents.find(d => d.id === currentItem?.documentId);
          const fileType = doc?.fileType || doc?.filePath?.split('.').pop()?.toLowerCase();
          return fileType === "epub" || fileType === "pdf" || fileType === "audio"
            ? t("queueScroll.helpTextDocFile")
            : t("queueScroll.helpTextDocScroll");
        })() : currentItem?.type === "podcast" ? t("queueScroll.helpTextDocFile") : currentItem ? t("queueScroll.helpTextNonDoc") : undefined}
        onExit={handleExit}
        onShowSettings={() => setShowSettings(true)}
        onShowRssSettings={() => setShowRssSettings(true)}
        onSetScrollViewMode={setScrollViewMode}
        onOpenExtractDialog={() => setIsExtractDialogOpen(true)}
        onRate={handleRating}
        onDismiss={handleDismiss}
        onGoToNext={goToNext}
        onGoToPrevious={goToPrevious}
        detailsButton={detailsTarget ? (
          <ItemDetailsPopover
            target={detailsTarget}
            onDismissStateChange={(dismissed) => {
              if (!dismissed) return;
              if (
                detailsTarget.type === "document" &&
                currentItem?.type === "document" &&
                currentItem.documentId === detailsTarget.id
              ) {
                advanceAfterRemoval(currentItem.id);
              }
              void loadQueue();
            }}
            renderTrigger={({ onClick, isOpen }) => (
              <button
                onClick={onClick}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 backdrop-blur-sm text-white text-sm transition-colors hover:bg-black/60",
                  isOpen && "bg-black/60"
                )}
                title={t("queueScroll.itemDetails")}
              >
                <Info className="w-4 h-4" />
                {t("queueScroll.details")}
              </button>
            )}
          />
        ) : undefined}
        labels={{
          exit: t("queueScroll.exitScrollMode"),
          settings: t("common.settings"),
          rss: t("queueScroll.rss"),
          viewDocument: t("viewer.viewDocument"),
          viewExtracts: t("viewer.viewExtracts"),
          viewLearningCards: t("viewer.viewLearningCards"),
          createExtract: t("viewer.createExtract"),
          again: t("queueScroll.again"),
          againTitle: t("queueScroll.againTitle"),
          hard: t("queueScroll.hard"),
          hardTitle: t("queueScroll.hardTitle"),
          good: t("queueScroll.good"),
          goodTitle: t("queueScroll.goodTitle"),
          easy: t("queueScroll.easy"),
          easyTitle: t("queueScroll.easyTitle"),
          dismissLabel: t("queueScroll.dismissLabel"),
          dismissTitle: t("queueScroll.dismissTitle"),
          markAsRead: t("queueScroll.markAsRead"),
          markAsReadGood: t("queueScroll.markAsReadGood"),
          previousDocument: t("queueScroll.previousDocument"),
          nextDocument: t("queueScroll.nextDocument"),
          docShort: t("queueScroll.docShort"),
          cardShort: t("queueScroll.cardShort"),
          rssShort: t("queueScroll.rssShort"),
          extractShort: t("queueScroll.extractShort"),
        }}
      />

      {/* RSS Queue Settings Modal */}
      <RSSQueueSettingsModal
        isOpen={showRssSettings}
        onClose={() => setShowRssSettings(false)}
      />
    </div>
  );
}
