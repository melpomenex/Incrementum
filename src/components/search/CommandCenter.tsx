import { useCallback, useEffect, useMemo, useRef } from "react";
import { GlobalSearch, SearchResult, SearchQuery, SearchResultType } from "./GlobalSearch";
import { useDocumentStore } from "../../stores/documentStore";
import { useTabsStore, type TabsState } from "../../stores/tabsStore";
import { useStudyDeckStore } from "../../stores/studyDeckStore";
import { useUIStore } from "../../stores/uiStore";
import { useExtractStore } from "../../stores/extractStore";
import { calculateRelevanceScore, extractSearchTerms, fuzzyMatch, highlightSearchTerms } from "./SearchUtils";
import { getDocuments as fetchDocuments } from "../../api/documents";
import { isTauri } from "../../lib/tauri";
import {
  DocumentViewer,
} from "../../components/tabs/TabRegistry";
import { Command, CommandCategory, getDefaultCommands } from "../common/CommandPalette";
import {
  BookOpen,
  BarChart3,
  Settings,
  LayoutDashboard,
  Library,
  ListTodo,
  Brain,
  FileText,
  Youtube,
  Palette,
  Sun,
  Moon,
  Images,
  Clipboard,
} from "lucide-react";
import type { Document, Extract } from "../../types/document";
import type { StudyDeck } from "../../types/study-decks";
import { fetchYouTubeTranscript } from "../../api/youtube";
import { getTranscript, type TranscriptSegment as WhisperTranscriptSegment } from "../../api/transcription";
import { useTheme } from "../../contexts/ThemeContext";
import { findMatchingSections } from "./sectionRegistry";
import type { ExactSearchHitLocation, SearchHit } from "../../types/searchHit";
import { registerCommandPaletteOpenEvents } from "../../utils/commandPaletteEvents";
import { getSubscribedFeedsAuto, type FeedItem } from "../../api/rss";
import { searchArticlesAuto } from "../../api/rss-search";
import { useRssStudyStore } from "../../stores/rssStudyStore";
import { getSubscribedPodcasts, getPodcastEpisodes, getPodcastTranscript } from "../../api/podcast";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "he",
  "her",
  "his",
  "i",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "not",
  "of",
  "on",
  "or",
  "our",
  "she",
  "so",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "to",
  "us",
  "was",
  "we",
  "were",
  "will",
  "with",
  "you",
  "your",
]);

const SHORT_MEANINGFUL_TERMS = new Set(["ai", "ml", "ui", "ux", "vr", "ar", "3d"]);

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

const isMeaningfulTerm = (term: string): boolean => {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return false;

  if (normalized.includes(" ")) {
    const parts = normalized.split(/\s+/).filter(Boolean);
    return parts.some((part) => !STOPWORDS.has(part));
  }

  if (STOPWORDS.has(normalized)) return false;
  if (/^\d+$/.test(normalized)) return normalized.length >= 2;
  if (normalized.length >= 3) return true;

  return SHORT_MEANINGFUL_TERMS.has(normalized);
};

const buildTranscriptText = (segments: Array<{ text: string }>): string =>
  segments
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const formatTimestamp = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

type SearchableTranscriptSegment = {
  id: string;
  startSeconds: number;
  text: string;
};

const normalizeAudioTranscriptSegments = (segments: unknown[]): SearchableTranscriptSegment[] =>
  segments
    .map((segment, index) => {
      const value = segment as {
        id?: string | number;
        text?: string;
        startTime?: number;
        start_ms?: number;
      };
      const text = typeof value.text === "string" ? value.text.trim() : "";
      const startSeconds =
        typeof value.startTime === "number"
          ? value.startTime
          : typeof value.start_ms === "number"
            ? value.start_ms / 1000
            : 0;

      if (!text || !Number.isFinite(startSeconds)) return null;

      return {
        id: value.id != null ? String(value.id) : `seg-${index}`,
        startSeconds: Math.max(0, startSeconds),
        text,
      };
    })
    .filter((segment): segment is SearchableTranscriptSegment => segment != null);

const readStoredAudioTranscript = (documentId: string): SearchableTranscriptSegment[] => {
  try {
    const data = window.localStorage.getItem(`audiobook-${documentId}`);
    if (!data) return [];
    const parsed = JSON.parse(data) as { transcript?: { segments?: unknown[] } };
    const segments = parsed.transcript?.segments;
    return Array.isArray(segments) ? normalizeAudioTranscriptSegments(segments) : [];
  } catch {
    return [];
  }
};

const readWhisperTranscript = async (documentId: string): Promise<SearchableTranscriptSegment[]> => {
  try {
    const response = await getTranscript(documentId, "default");
    const segments: WhisperTranscriptSegment[] = response?.segments ?? [];
    return normalizeAudioTranscriptSegments(segments);
  } catch (error) {
    console.warn("[CommandCenter] Failed to load audio transcript", documentId, error);
    return [];
  }
};

// Stable selectors defined outside component to avoid infinite re-renders
const selectAddTab = (state: TabsState) => state.addTab;
const selectActiveDeckIds = (state: { activeDeckIds: string[] }) => state.activeDeckIds;
const selectCommandPaletteOpen = (state: { commandPaletteOpen: boolean }) => state.commandPaletteOpen;
const selectSetCommandPaletteOpen = (state: { setCommandPaletteOpen: (open: boolean) => void }) => state.setCommandPaletteOpen;
const selectDocuments = (state: { documents: Document[] }) => state.documents;
const selectDocumentsLoading = (state: { isLoading: boolean }) => state.isLoading;
const selectLoadDocuments = (state: { loadDocuments: () => Promise<void> }) => state.loadDocuments;
const selectDecks = (state: { decks: StudyDeck[] }) => state.decks;
const selectExtracts = (state: { extracts: Extract[] }) => state.extracts;
const selectExtractsLoading = (state: { isLoading: boolean }) => state.isLoading;
const selectLoadExtracts = (state: { loadExtracts: (documentId?: string) => Promise<void> }) =>
  state.loadExtracts;

export function CommandCenter() {
  const documents = useDocumentStore(selectDocuments);
  const documentsLoading = useDocumentStore(selectDocumentsLoading);
  const loadDocuments = useDocumentStore(selectLoadDocuments);
  const addTab = useTabsStore(selectAddTab);
  const decks = useStudyDeckStore(selectDecks);
  const activeDeckIds = useStudyDeckStore(selectActiveDeckIds);
  const commandPaletteOpen = useUIStore(selectCommandPaletteOpen);
  const setCommandPaletteOpen = useUIStore(selectSetCommandPaletteOpen);
  const extracts = useExtractStore(selectExtracts);
  const _extractsLoading = useExtractStore(selectExtractsLoading);
  const loadExtracts = useExtractStore(selectLoadExtracts);
  const extractsLoadedRef = useRef(false);
  const documentsSnapshotRef = useRef<Document[]>([]);
  const documentsFetchInFlight = useRef<Promise<Document[]> | null>(null);
  const transcriptCacheRef = useRef<Map<string, { text: string; lower: string }>>(new Map());
  const transcriptFetchInFlightRef = useRef<Set<string>>(new Set());
  const audioTranscriptCacheRef = useRef<Map<string, SearchableTranscriptSegment[]>>(new Map());
  const htmlTextCacheRef = useRef<Map<string, { text: string; lower: string }>>(new Map());
  const documentsRef = useRef(documents);
  documentsRef.current = documents;
  const extractsRef = useRef(extracts);
  extractsRef.current = extracts;
  const { theme, themes, setTheme } = useTheme();

  const rssArticlesCacheRef = useRef<Array<{ item: FeedItem; feedId: string; feedTitle: string }>>([]);
  const isRssCacheLoadingRef = useRef(false);

  useEffect(() => {
    if (!documentsLoading && documents.length === 0) {
      void loadDocuments();
    }
  }, [documents.length, documentsLoading, loadDocuments]);

  // Pre-fetch all RSS articles once when command palette opens in RSS view
  useEffect(() => {
    const getActiveTab = () => {
      const state = useTabsStore.getState();
      const paneIds = state.getTabPaneIds();
      if (paneIds.length === 0) return null;
      const pane = state.findPaneById(paneIds[0]);
      if (!pane || pane.type !== "tabs" || !pane.activeTabId) return null;
      return state.tabs.find(t => t.id === pane.activeTabId) || null;
    };
    const activeTab = getActiveTab();
    const isRssView = activeTab?.type === "rss";

    if (commandPaletteOpen && isRssView) {
      const loadRssArticlesToCache = async () => {
        if (isRssCacheLoadingRef.current) return;
        isRssCacheLoadingRef.current = true;
        try {
          const feeds = await getSubscribedFeedsAuto();
          const cached: Array<{ item: FeedItem; feedId: string; feedTitle: string }> = [];
          feeds.forEach((feed) => {
            (feed.items || []).forEach((item) => {
              cached.push({
                item,
                feedId: feed.id,
                feedTitle: feed.title,
              });
            });
          });
          rssArticlesCacheRef.current = cached;
        } catch (err) {
          console.warn("[CommandCenter] Failed to pre-fetch RSS articles for cache", err);
        } finally {
          isRssCacheLoadingRef.current = false;
        }
      };
      
      void loadRssArticlesToCache();
    } else if (!commandPaletteOpen) {
      rssArticlesCacheRef.current = [];
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    if (documents.length > 0) {
      documentsSnapshotRef.current = documents;
    }
  }, [documents]);

  // Extracts are loaded lazily inside handleSearch when a content search is performed.
  // This avoids fetching ALL extracts (potentially thousands) on every palette open.

  // Document content extraction is NOT triggered on palette open.
  // Content is fetched lazily per-document during search if needed,
  // or the user can trigger extraction through other UI flows.
  // This prevents blocking the main thread with sequential I/O on large collections.

  const activeDeck = useMemo(
    () => {
      if (activeDeckIds.length === 0) return null;
      return decks.find((item) => item.id === activeDeckIds[0]) ?? null;
    },
    [decks, activeDeckIds]
  );
  const shouldFilterByDeck = false;

  const handleSearch = useCallback(async (query: SearchQuery): Promise<SearchResult[]> => {
    const term = query.query.toLowerCase().trim();
    const results: SearchResult[] = [];
    if (!term) return results;

    // Lazy-load extracts for content search (once per session)
    const queryTerms = extractSearchTerms(query.query)
      .map((item) => item.toLowerCase().trim())
      .filter(Boolean);
    const meaningfulTerms = queryTerms.filter(isMeaningfulTerm);
    if (meaningfulTerms.length > 0 && !extractsLoadedRef.current) {
      extractsLoadedRef.current = true;
      void loadExtracts();
    }
    const searchTerms = meaningfulTerms.length > 0 ? meaningfulTerms : [term];
    const allowContentSearch = meaningfulTerms.length > 0;

    // Read from refs for stable closure
    const docs = documentsRef.current;
    const exts = extractsRef.current;

    const matchesTerms = (text: string, terms: string[]): boolean =>
      terms.some((value) => text.includes(value));

    const fuzzyMatches = (text: string): boolean => {
      if (!allowContentSearch) return false;
      if (term.length < 3) return false;
      if (text.length > 80) return false;
      const { match, score } = fuzzyMatch(text, term, 2);
      return match && score >= 0.6;
    };

    const isWeb = !isTauri();
    const maxResults = 50;
    const maxDocsToScan = 500;
    const maxExtractsToScan = 500;
    const maxTranscriptFetches = 3;
    let _transcriptFetches = 0;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const findAllOccurrences = (haystackLower: string, needleLower: string, limit: number): number[] => {
      if (!needleLower) return [];
      const out: number[] = [];
      let idx = 0;
      while (idx >= 0 && out.length < limit) {
        idx = haystackLower.indexOf(needleLower, idx);
        if (idx >= 0) {
          out.push(idx);
          idx += Math.max(1, needleLower.length);
        }
      }
      return out;
    };

    const excerptFromIndex = (source: string, index: number, rawQuery: string): string => {
      const context = 90;
      const start = Math.max(0, index - context);
      const end = Math.min(source.length, index + context);
      const slice = source.slice(start, end);
      const { excerpt } = highlightSearchTerms(slice, rawQuery, 200);
      return excerpt;
    };

    const exactQuoteFromIndex = (source: string, index: number, matchedText: string): string => {
      if (!matchedText) return "";
      return source
        .slice(index, index + matchedText.length)
        .replace(/\s+/g, " ")
        .trim();
    };

    const quoteContextFromIndex = (source: string, index: number, matchedText: string): string => {
      const context = 120;
      const start = Math.max(0, index - context);
      const end = Math.min(source.length, index + matchedText.length + context);
      return source
        .slice(start, end)
        .replace(/\s+/g, " ")
        .trim();
    };

    const buildPdfPageFromIndex = (doc: Document, index: number, contentLength: number): number => {
      const totalPages = doc.totalPages ?? doc.metadata?.pageCount ?? 1;
      if (!contentLength || totalPages <= 1) return 1;
      const pct = clamp(index / contentLength, 0, 1);
      return clamp(Math.round(pct * (totalPages - 1)) + 1, 1, totalPages);
    };

    const getHtmlText = (doc: Document): { text: string; lower: string } => {
      const cached = htmlTextCacheRef.current.get(doc.id);
      if (cached) return cached;
      const html = doc.content ?? "";
      if (!html) {
        const empty = { text: "", lower: "" };
        htmlTextCacheRef.current.set(doc.id, empty);
        return empty;
      }
      try {
        const parser = new DOMParser();
        const parsed = parser.parseFromString(html, "text/html");
        parsed.querySelectorAll("script, style").forEach((el) => el.remove());
        const text = (parsed.body?.textContent ?? "").replace(/\s+/g, " ").trim();
        const entry = { text, lower: text.toLowerCase() };
        htmlTextCacheRef.current.set(doc.id, entry);
        return entry;
      } catch {
        const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const entry = { text, lower: text.toLowerCase() };
        htmlTextCacheRef.current.set(doc.id, entry);
        return entry;
      }
    };

    const groupedDocs = new Map<string, {
      doc: Document;
      score: number;
      excerpt?: string;
      highlights?: string[];
      transcriptMatch?: boolean;
      hits: SearchHit[];
    }>();

    let docsForSearch = docs.length > 0 ? docs : documentsSnapshotRef.current;
    if (docsForSearch.length === 0 && !documentsLoading) {
      if (!documentsFetchInFlight.current) {
        documentsFetchInFlight.current = fetchDocuments().catch((error) => {
          console.warn("[CommandCenter] Failed to fetch documents for search", error);
          return [];
        });
      }
      docsForSearch = await documentsFetchInFlight.current;
      documentsFetchInFlight.current = null;
      if (docsForSearch.length > 0) {
        documentsSnapshotRef.current = docsForSearch;
      }
    }

    // 1. Search Commands
    const navigateTo = (path: string) => {
      window.dispatchEvent(new CustomEvent("navigate", { detail: path }));
    };

    const navigationCommands: Command[] = [
      {
        id: "nav-dashboard",
        label: "Go to Dashboard",
        description: "Navigate to the dashboard",
        icon: <LayoutDashboard className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => navigateTo("/dashboard"),
        keywords: ["home", "main"],
      },
      {
        id: "nav-documents",
        label: "Go to Documents",
        description: "View all documents",
        icon: <Library className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => navigateTo("/documents"),
        keywords: ["library", "files"],
      },
      {
        id: "nav-queue",
        label: "Go to Queue",
        description: "View reading queue",
        icon: <ListTodo className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => navigateTo("/queue"),
        keywords: ["list", "reading"],
      },
      {
        id: "nav-analytics",
        label: "Go to Statistics",
        description: "View learning statistics",
        icon: <BarChart3 className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => navigateTo("/analytics"),
        keywords: ["stats", "progress"],
      },
      {
        id: "nav-settings",
        label: "Go to Settings",
        description: "View application settings",
        icon: <Settings className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => navigateTo("/settings"),
        keywords: ["config", "preferences"],
      },
      {
        id: "nav-review",
        label: "Start Review",
        description: "Start a review session",
        icon: <Brain className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => navigateTo("/review"),
        keywords: ["review", "study"],
      },
      {
        id: "nav-image-registry",
        label: "Image Registry",
        description: "View and manage image registry",
        icon: <Images className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => navigateTo("/image-registry"),
        keywords: ["images", "screenshots", "registry", "library", "flashcards"],
      },
    ];

    const cycleTheme = (direction: 1 | -1) => {
      if (!themes.length) return;
      const currentIndex = themes.findIndex((item) => item.id === theme.id);
      const startIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = (startIndex + direction + themes.length) % themes.length;
      setTheme(themes[nextIndex].id);
    };

    const switchThemeVariant = (variant: "light" | "dark") => {
      if (!themes.length) return;
      const variantThemes = themes.filter((item) => item.variant === variant);
      if (variantThemes.length === 0) return;
      const activeVariantIndex = variantThemes.findIndex((item) => item.id === theme.id);
      const next = variantThemes[(activeVariantIndex + 1 + variantThemes.length) % variantThemes.length];
      setTheme(next.id);
    };

    const themeCommands: Command[] = [
      {
        id: "theme-toggle-variant",
        label: "Toggle Theme Variant",
        description: `Switch between light and dark themes (current: ${theme.variant})`,
        icon: <Palette className="w-4 h-4" />,
        category: CommandCategory.Settings,
        action: () => {
          const targetVariant = theme.variant === "dark" ? "light" : "dark";
          switchThemeVariant(targetVariant);
        },
        keywords: ["theme", "appearance", "dark", "light", "mode", "toggle"],
      },
      {
        id: "theme-set-light",
        label: "Switch to Light Theme",
        description: "Apply a light variant theme",
        icon: <Sun className="w-4 h-4" />,
        category: CommandCategory.Settings,
        action: () => switchThemeVariant("light"),
        keywords: ["theme", "appearance", "light", "day"],
      },
      {
        id: "theme-set-dark",
        label: "Switch to Dark Theme",
        description: "Apply a dark variant theme",
        icon: <Moon className="w-4 h-4" />,
        category: CommandCategory.Settings,
        action: () => switchThemeVariant("dark"),
        keywords: ["theme", "appearance", "dark", "night"],
      },
      {
        id: "theme-next",
        label: "Next Theme",
        description: `Cycle to the next theme (current: ${theme.name})`,
        icon: <Palette className="w-4 h-4" />,
        category: CommandCategory.Settings,
        action: () => cycleTheme(1),
        keywords: ["theme", "appearance", "next", "cycle"],
      },
      {
        id: "theme-previous",
        label: "Previous Theme",
        description: `Cycle to the previous theme (current: ${theme.name})`,
        icon: <Palette className="w-4 h-4" />,
        category: CommandCategory.Settings,
        action: () => cycleTheme(-1),
        keywords: ["theme", "appearance", "previous", "cycle"],
      },
    ];

    const themeSwitchCommands: Command[] = themes.map((item) => ({
      id: `theme-switch-${item.id}`,
      label: `Switch Theme: ${item.name}`,
      description: `Apply ${item.variant} theme "${item.name}"`,
      icon: <Palette className="w-4 h-4" />,
      category: CommandCategory.Settings,
      action: () => setTheme(item.id),
      keywords: [
        "theme",
        "appearance",
        "switch",
        "set",
        item.name.toLowerCase(),
        item.id.toLowerCase(),
        item.variant.toLowerCase(),
      ],
    }));

    // Detect active document for contextual commands
    const getActiveTab = () => {
      const state = useTabsStore.getState();
      const paneIds = state.getTabPaneIds();
      if (paneIds.length === 0) return null;
      const pane = state.findPaneById(paneIds[0]);
      if (!pane || pane.type !== "tabs" || !pane.activeTabId) return null;
      return state.tabs.find(t => t.id === pane.activeTabId) || null;
    };
    const activeTab = getActiveTab();
    const selectedDocumentTitle = activeTab?.type === "document-viewer" && activeTab.data?.documentId
      ? (documents.find(d => d.id === activeTab.data.documentId)?.title ?? null)
      : null;
    const isRssView = activeTab?.type === "rss";
    const isPodcastView = activeTab?.type === "podcast";

    const allCommands = [
      ...getDefaultCommands().filter((cmd) => ![
        "go-documents",
        "go-queue",
        "go-analytics",
        "go-image-registry",
        "open-settings",
        "start-review",
      ].includes(cmd.id)),
      // Paste Extract command
      {
        id: "paste-extract",
        label: "Paste Extract",
        description: selectedDocumentTitle
          ? `Save pasted content as an extract in "${selectedDocumentTitle}"`
          : "Paste content from clipboard and save as an extract",
        icon: <Clipboard className="w-4 h-4" />,
        category: CommandCategory.Extracts,
        action: () => {
          const ui = useUIStore.getState();
          ui.setCommandPaletteOpen(false);
          ui.setPasteExtractDialogOpen(true);
        },
        keywords: ["clipboard", "paste", "save", "new", "extract", "import"],
      },
      ...navigationCommands,
      ...themeCommands,
      ...themeSwitchCommands,
    ];

    if (isRssView) {
      try {
        const lowerQuery = query.query.toLowerCase().trim();
        const matches: SearchResult[] = [];
        
        if (lowerQuery) {
          let cachedArticles = rssArticlesCacheRef.current;
          if (cachedArticles.length === 0) {
            // Fallback if cache is not loaded yet
            const feeds = await getSubscribedFeedsAuto();
            const cached: Array<{ item: FeedItem; feedId: string; feedTitle: string }> = [];
            feeds.forEach((feed) => {
              (feed.items || []).forEach((item) => {
                cached.push({
                  item,
                  feedId: feed.id,
                  feedTitle: feed.title,
                });
              });
            });
            rssArticlesCacheRef.current = cached;
            cachedArticles = cached;
          }

          cachedArticles.forEach(({ item, feedId }) => {
            const title = item.title || "";
            const desc = item.description || "";
            const content = item.content || "";
            
            const titleMatch = title.toLowerCase().includes(lowerQuery);
            const descMatch = desc.toLowerCase().includes(lowerQuery);
            const contentMatch = content.toLowerCase().includes(lowerQuery);
            
            if (titleMatch || descMatch || contentMatch) {
              let score = 0.5;
              if (titleMatch) score = 0.9;
              else if (descMatch) score = 0.7;
              
              const cleanDesc = desc.replace(/<[^>]+>/g, " ").trim();
              const excerpt = cleanDesc.length > 150 ? cleanDesc.slice(0, 150) + "..." : cleanDesc;
              
              matches.push({
                id: `rss-${item.id}`,
                type: SearchResultType.Document,
                title: item.title,
                excerpt: excerpt || "Read article",
                score,
                metadata: {
                  resultKind: "rss-article",
                  articleId: item.id,
                  feedId: feedId,
                  category: "RSS Article",
                } as any
              });
            }
          });
        }
        
        const matchedCommands = allCommands.filter((cmd) => {
          const label = cmd.label.toLowerCase();
          const description = cmd.description?.toLowerCase() ?? "";
          const keywords = cmd.keywords?.map((keyword) => keyword.toLowerCase()) ?? [];
          return label.includes(lowerQuery) || description.includes(lowerQuery) || keywords.some((keyword) => keyword.includes(lowerQuery));
        });
        
        matchedCommands.forEach((cmd) => {
          matches.push({
            id: `cmd-${cmd.id}`,
            type: SearchResultType.Command,
            title: cmd.label,
            excerpt: cmd.description,
            score: 0.8,
            metadata: {
              action: cmd.action,
              resultKind: "command",
            },
          });
        });
        
        const sectionMatches = findMatchingSections(query.query);
        sectionMatches.forEach(({ section, score }) => {
          matches.push({
            id: `section-${section.id}`,
            type: SearchResultType.Command,
            title: section.label,
            excerpt: `Open ${section.label}`,
            score,
            metadata: {
              category: "Section",
              sectionId: section.id,
              targetPath: section.path,
              resultKind: "section",
              action: () => navigateTo(section.path),
            },
          });
        });
        
        return matches.sort((a, b) => b.score - a.score).slice(0, maxResults);
      } catch (err) {
        console.error("RSS Search error:", err);
      }
    }

    if (isPodcastView) {
      try {
        const podcasts = await getSubscribedPodcasts();
        const lowerQuery = query.query.toLowerCase().trim();
        const matches: SearchResult[] = [];
        
        const episodesLists = await Promise.all(
          podcasts.map(feed => getPodcastEpisodes(feed.id, true).catch(() => []))
        );
        
        for (let fIdx = 0; fIdx < podcasts.length; fIdx++) {
          const feed = podcasts[fIdx];
          const eps = episodesLists[fIdx];
          
          for (const ep of eps) {
            const title = ep.title || "";
            const desc = ep.description || "";
            const transcriptText = ep.transcriptText || "";
            
            const titleMatch = title.toLowerCase().includes(lowerQuery);
            const descMatch = desc.toLowerCase().includes(lowerQuery);
            const transcriptMatch = transcriptText.toLowerCase().includes(lowerQuery);
            
            if (titleMatch || descMatch || transcriptMatch) {
              let score = 0.5;
              if (titleMatch) score = 0.9;
              else if (descMatch) score = 0.7;
              else if (transcriptMatch) score = 0.6;
              
              const cleanDesc = desc.replace(/<[^>]+>/g, " ").trim();
              let excerpt = cleanDesc.length > 150 ? cleanDesc.slice(0, 150) + "..." : cleanDesc;
              
              let primaryHit: SearchHit | undefined = undefined;
              const secondaryHits: SearchHit[] = [];
              
              if (transcriptMatch) {
                try {
                  const transcriptData = await getPodcastTranscript(ep.id);
                  if (transcriptData?.segments) {
                    const matchingSegments = transcriptData.segments.filter(
                      (seg) => seg.text.toLowerCase().includes(lowerQuery)
                    );
                    
                    matchingSegments.forEach((seg, sIdx) => {
                      const startSec = seg.start / 1000;
                      const mm = String(Math.floor(startSec / 60)).padStart(2, "0");
                      const ss = String(Math.floor(startSec % 60)).padStart(2, "0");
                      const label = `${mm}:${ss}`;
                      
                      const hit: SearchHit = {
                        id: `pod-hit-${ep.id}-${sIdx}`,
                        location: {
                          kind: "audio",
                          timeSeconds: startSec,
                          textQuote: seg.text,
                        },
                        label,
                        excerptHtml: seg.text.replace(new RegExp(`(${lowerQuery})`, "ig"), "<mark class='bg-amber-200 dark:bg-amber-800 text-foreground'>$1</mark>"),
                      };
                      
                      if (!primaryHit) {
                        primaryHit = hit;
                      } else {
                        secondaryHits.push(hit);
                      }
                    });
                  }
                } catch (e) {
                  console.warn("[PodcastSearch] Failed to fetch transcript segments", ep.id, e);
                }
              }
              
              if (primaryHit) {
                excerpt = `Transcript match: ${primaryHit.excerptHtml}`;
              }
              
              matches.push({
                id: `podcast-ep-${ep.id}`,
                type: SearchResultType.Document,
                title: ep.title,
                excerpt: excerpt || "Listen to episode",
                score,
                metadata: {
                  resultKind: "podcast-episode",
                  episodeId: ep.id,
                  feedId: feed.id,
                  category: "Podcast Episode",
                  transcriptMatch,
                  primaryHit,
                  secondaryHits: secondaryHits.length > 0 ? secondaryHits : undefined,
                } as any
              });
            }
          }
        }
        
        const matchedCommands = allCommands.filter((cmd) => {
          const label = cmd.label.toLowerCase();
          const description = cmd.description?.toLowerCase() ?? "";
          const keywords = cmd.keywords?.map((keyword) => keyword.toLowerCase()) ?? [];
          return label.includes(lowerQuery) || description.includes(lowerQuery) || keywords.some((keyword) => keyword.includes(lowerQuery));
        });
        
        matchedCommands.forEach((cmd) => {
          matches.push({
            id: `cmd-${cmd.id}`,
            type: SearchResultType.Command,
            title: cmd.label,
            excerpt: cmd.description,
            score: 0.8,
            metadata: {
              action: cmd.action,
              resultKind: "command",
            },
          });
        });
        
        const sectionMatches = findMatchingSections(query.query);
        sectionMatches.forEach(({ section, score }) => {
          matches.push({
            id: `section-${section.id}`,
            type: SearchResultType.Command,
            title: section.label,
            excerpt: `Open ${section.label}`,
            score,
            metadata: {
              category: "Section",
              sectionId: section.id,
              targetPath: section.path,
              resultKind: "section",
              action: () => navigateTo(section.path),
            },
          });
        });
        
        return matches.sort((a, b) => b.score - a.score).slice(0, maxResults);
      } catch (err) {
        console.error("Podcast search error:", err);
      }
    }

    const matchedCommands = allCommands.filter((cmd) => {
      const label = cmd.label.toLowerCase();
      const description = cmd.description?.toLowerCase() ?? "";
      const keywords = cmd.keywords?.map((keyword) => keyword.toLowerCase()) ?? [];
      const termMatch = matchesTerms(label, searchTerms) || matchesTerms(description, searchTerms);
      const keywordMatch = keywords.some((keyword) => matchesTerms(keyword, searchTerms));

      if (termMatch || keywordMatch) return true;
      return fuzzyMatches(label) || (description ? fuzzyMatches(description) : false);
    });

    const sectionMatches = findMatchingSections(query.query);
    sectionMatches.forEach(({ section, score }) => {
      results.push({
        id: `section-${section.id}`,
        type: SearchResultType.Command,
        title: section.label,
        excerpt: `Open ${section.label}`,
        score,
        metadata: {
          category: "Section",
          sectionId: section.id,
          targetPath: section.path,
          resultKind: "section",
          action: () => navigateTo(section.path),
        },
      });
    });

    matchedCommands.forEach((cmd) => {
      results.push({
        id: `cmd-${cmd.id}`,
        type: SearchResultType.Command,
        title: cmd.label,
        excerpt: cmd.description,
        score: 0.8,
        metadata: {
          action: cmd.action,
          resultKind: "command",
        },
      });
    });

    // 2. Search Documents (grouped: one row per document)
    if (!query.types || query.types.includes(SearchResultType.Document)) {
      const scopedDocs = docsForSearch;

      // Pre-fetch YouTube transcripts concurrently (up to maxTranscriptFetches)
      // instead of sequential await-in-loop inside the per-document scan
      if (allowContentSearch) {
        const youtubeDocsNeedingFetch: Document[] = [];
        for (const doc of scopedDocs) {
          if (youtubeDocsNeedingFetch.length >= maxTranscriptFetches) break;
          if (doc.fileType !== "youtube") continue;
          if (transcriptCacheRef.current.has(doc.id)) continue;
          if (transcriptFetchInFlightRef.current.has(doc.id)) continue;
          youtubeDocsNeedingFetch.push(doc);
        }
        if (youtubeDocsNeedingFetch.length > 0) {
          youtubeDocsNeedingFetch.forEach((doc) => transcriptFetchInFlightRef.current.add(doc.id));
          await Promise.allSettled(
            youtubeDocsNeedingFetch.map(async (doc) => {
              try {
                const videoId = extractYouTubeId(doc.filePath);
                if (!videoId) return;
                const segments = await fetchYouTubeTranscript(videoId);
                if (segments.length > 0) {
                  const text = buildTranscriptText(segments);
                  if (text) {
                    transcriptCacheRef.current.set(doc.id, { text, lower: text.toLowerCase() });
                  }
                }
              } catch (error) {
                console.warn("[CommandCenter] Failed to pre-fetch YouTube transcript", doc.id, error);
              } finally {
                transcriptFetchInFlightRef.current.delete(doc.id);
              }
            })
          );
        }
      }

      let scanned = 0;
      for (const doc of scopedDocs) {
        if (scanned >= maxDocsToScan || groupedDocs.size >= maxResults) break;
        scanned += 1;

        const titleLower = doc.title.toLowerCase();
        const titleMatch = matchesTerms(titleLower, searchTerms) || (!allowContentSearch && titleLower.includes(term)) || fuzzyMatches(titleLower);

        let content = doc.content ?? "";
        let contentLower = content.toLowerCase();
        if (doc.fileType === "html") {
          const htmlText = getHtmlText(doc);
          content = htmlText.text;
          contentLower = htmlText.lower;
        }

        const contentMatch = !isWeb && allowContentSearch && matchesTerms(contentLower, searchTerms);

        const hits: SearchHit[] = [];

        // Transcript hits (YouTube) — read from cache; pre-fetched concurrently above
        let transcriptMatch = false;
        if (allowContentSearch && doc.fileType === "youtube" && groupedDocs.size < maxResults) {
          const cached = transcriptCacheRef.current.get(doc.id);
          let transcriptLower: string | null = cached?.lower ?? null;

          if (transcriptLower) {
            transcriptMatch = matchesTerms(transcriptLower, searchTerms);

            // Re-fetch segments for timestamp-level hits when we have a transcript match
            try {
              const videoId = extractYouTubeId(doc.filePath);
              if (videoId) {
                const segments = await fetchYouTubeTranscript(videoId);
                const matchingSegments = segments
                  .map((seg, idx) => ({ seg, idx }))
                  .filter(({ seg }) => {
                    const segLower = seg.text.toLowerCase();
                    return matchesTerms(segLower, searchTerms);
                  })
                  .slice(0, 6);

                matchingSegments.forEach(({ seg, idx }, i) => {
                  const { excerpt } = highlightSearchTerms(seg.text, query.query, 200);
                  hits.push({
                    id: `yt-hit-${doc.id}-${i}`,
                    location: {
                      kind: "youtube",
                      timeSeconds: seg.start,
                      segmentId: `seg-${idx}`,
                      textQuote: seg.text,
                    },
                    label: formatTimestamp(seg.start),
                    excerptHtml: excerpt,
                  });
                });
              }
            } catch (error) {
              console.warn("[CommandCenter] Failed to fetch YouTube segments for hits", doc.id, error);
            }
          }
        }

        // Transcript hits (local audio)
        if (allowContentSearch && doc.fileType === "audio" && groupedDocs.size < maxResults) {
          let segments = audioTranscriptCacheRef.current.get(doc.id) ?? readStoredAudioTranscript(doc.id);
          if (segments.length > 0) {
            audioTranscriptCacheRef.current.set(doc.id, segments);
          } else {
            segments = await readWhisperTranscript(doc.id);
            if (segments.length > 0) {
              audioTranscriptCacheRef.current.set(doc.id, segments);
            }
          }

          if (segments.length > 0) {
            const transcriptText = segments.map((segment) => segment.text).join(" ");
            const transcriptLower = transcriptText.toLowerCase();
            transcriptMatch = matchesTerms(transcriptLower, searchTerms);

            const matchingSegments = segments
              .filter((segment) => matchesTerms(segment.text.toLowerCase(), searchTerms))
              .slice(0, 6);

            matchingSegments.forEach((segment, i) => {
              const { excerpt } = highlightSearchTerms(segment.text, query.query, 200);
              hits.push({
                id: `audio-hit-${doc.id}-${i}`,
                location: {
                  kind: "audio",
                  timeSeconds: segment.startSeconds,
                  segmentId: segment.id,
                  textQuote: segment.text,
                },
                label: formatTimestamp(segment.startSeconds),
                excerptHtml: excerpt,
              });
            });
          }
        }

        // Text hits (EPUB): preserve document-order match indexes so secondary
        // match clicks navigate to the selected quote, not the first occurrence.
        if (allowContentSearch && doc.fileType === "epub") {
          const epubOccurrences = searchTerms
            .flatMap((t) => findAllOccurrences(contentLower, t, 50).map((index) => ({ term: t, index })))
            .sort((a, b) => a.index - b.index)
            .filter((occurrence, index, list) =>
              index === 0 || occurrence.index !== list[index - 1].index
            );

          epubOccurrences.slice(0, 6).forEach(({ term, index }, matchIndex) => {
            hits.push({
              id: `hit-${doc.id}-${term}-${index}`,
              location: {
                kind: "epub",
                cfi: "",
                textQuote: quoteContextFromIndex(content, index, term),
                matchIndex,
              },
              label: "EPUB",
              excerptHtml: excerptFromIndex(content, index, query.query),
            });
          });
        }

        // Text hits (PDF/HTML/Markdown/etc)
        if (allowContentSearch && doc.fileType !== "youtube" && doc.fileType !== "audio") {
          for (const t of searchTerms) {
            if (hits.length >= 6) break;
            const occ = findAllOccurrences(contentLower, t, 6 - hits.length);
            occ.forEach((index, _occIndex) => {
              if (doc.fileType === "pdf") {
                const pageNum = buildPdfPageFromIndex(doc, index, Math.max(1, contentLower.length));
                hits.push({
                  id: `hit-${doc.id}-${t}-${index}`,
                  location: {
                    kind: "pdf",
                    pageNumber: pageNum,
                    textQuote: exactQuoteFromIndex(content, index, t),
                    textOffsetHint: index,
                  },
                  label: `Page ${pageNum}`,
                  excerptHtml: excerptFromIndex(content, index, query.query),
                });
              } else if (doc.fileType === "epub") {
                return;
              } else if (doc.fileType === "html") {
                const pct = clamp(Math.round((index / Math.max(1, contentLower.length)) * 100), 0, 100);
                hits.push({
                  id: `hit-${doc.id}-${t}-${index}`,
                  location: {
                    kind: "html",
                    scrollPercent: pct,
                    textQuote: exactQuoteFromIndex(content, index, t),
                  },
                  label: `${pct}%`,
                  excerptHtml: excerptFromIndex(content, index, query.query),
                });
              } else if (doc.fileType === "markdown") {
                const pct = clamp(Math.round((index / Math.max(1, contentLower.length)) * 100), 0, 100);
                hits.push({
                  id: `hit-${doc.id}-${t}-${index}`,
                  location: {
                    kind: "markdown",
                    scrollPercent: pct,
                    textQuote: exactQuoteFromIndex(content, index, t),
                  },
                  label: `${pct}%`,
                  excerptHtml: excerptFromIndex(content, index, query.query),
                });
              } else {
                const pct = clamp(Math.round((index / Math.max(1, contentLower.length)) * 100), 0, 100);
                hits.push({
                  id: `hit-${doc.id}-${t}-${index}`,
                  location: {
                    kind: "html",
                    scrollPercent: pct,
                    textQuote: exactQuoteFromIndex(content, index, t),
                  },
                  label: `${pct}%`,
                  excerptHtml: excerptFromIndex(content, index, query.query),
                });
              }
            });
          }
        }

        const isMatch = titleMatch || contentMatch || transcriptMatch || hits.length > 0;
        if (!isMatch) continue;

        const score = calculateRelevanceScore(
          { title: doc.title, content: content },
          query.query,
          SearchResultType.Document
        ) / 100;

        groupedDocs.set(doc.id, {
          doc,
          score,
          transcriptMatch,
          hits,
        });
      }
    }

    // 3. Search Extracts and attach as secondary hits to their parent document.
    if (!query.types || query.types.includes(SearchResultType.Extract)) {
      let scanned = 0;
      for (const extract of exts) {
        if (scanned >= maxExtractsToScan) break;
        scanned += 1;

        const content = extract.content ?? "";
        const contentLower = content.toLowerCase();
        if (!allowContentSearch || !matchesTerms(contentLower, searchTerms)) continue;

        const docId = extract.documentId;
        const parentDoc = docs.find((d) => d.id === docId);
        if (!parentDoc) continue;

        if (!groupedDocs.has(docId) && groupedDocs.size < maxResults) {
          groupedDocs.set(docId, { doc: parentDoc, score: 0.5, hits: [], transcriptMatch: false });
        }

        const entry = groupedDocs.get(docId);
        if (!entry) continue;

        const { excerpt } = highlightSearchTerms(content, query.query, 200);
        const pageNum = extract.pageNumber && extract.pageNumber > 0 ? extract.pageNumber : 1;
        entry.hits.push({
          id: `extract-hit-${extract.id}`,
          location: {
            kind: "pdf",
            pageNumber: pageNum,
            textQuote: query.query.trim() || undefined,
          },
          label: `Page ${pageNum}`,
          excerptHtml: excerpt,
        });
      }
    }

    // Materialize grouped results: one row per document.
    groupedDocs.forEach((entry) => {
      const doc = entry.doc;
      const sortedHits = entry.hits.slice(0);

      // Prefer timestamped transcript hits first, then extract hits, then others.
      sortedHits.sort((a, b) => {
        const ak = a.location.kind;
        const bk = b.location.kind;
        const pri = (k: string) => k === "youtube" || k === "audio" ? 0 : k === "pdf" ? 1 : 2;
        return pri(ak) - pri(bk);
      });

      const primaryHit = sortedHits[0];
      const secondaryHits = sortedHits.slice(1, 6);

      results.push({
        id: doc.id,
        type: SearchResultType.Document,
        title: doc.title,
        excerpt: primaryHit?.excerptHtml
          ? (entry.transcriptMatch ? `Transcript — ${primaryHit.excerptHtml}` : primaryHit.excerptHtml)
          : undefined,
        highlights: [],
        score: entry.score,
        metadata: {
          documentId: doc.id,
          fileType: doc.fileType,
          category: doc.category,
          tags: doc.tags ?? [],
          transcriptMatch: entry.transcriptMatch,
          highlightQuery: query.query,
          primaryHit,
          secondaryHits: secondaryHits.length > 0 ? secondaryHits : undefined,
        },
      });
    });

    return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
  }, [loadExtracts, activeDeck, shouldFilterByDeck, theme.id, theme.name, theme.variant, themes, setTheme]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const handleResultClick = useCallback((result: SearchResult) => {
    if (result.metadata?.resultKind === "rss-article") {
      const articleId = result.metadata.articleId;
      useRssStudyStore.getState().setActiveArticleToView(articleId);
      window.dispatchEvent(new CustomEvent("navigate", { detail: "/rss" }));
      return;
    }

    if (result.metadata?.resultKind === "podcast-episode") {
      const feedId = result.metadata.feedId;
      const episodeId = result.metadata.episodeId;
      const primaryHit = result.metadata.primaryHit;
      const location = primaryHit?.location;
      const seekTime = (location && (location.kind === "audio" || location.kind === "youtube"))
        ? location.timeSeconds
        : 0;
      
      window.dispatchEvent(new CustomEvent("play-podcast-episode", {
        detail: { feedId, episodeId, seekTime }
      }));
      window.dispatchEvent(new CustomEvent("navigate", { detail: "/podcast" }));
      return;
    }

    if (result.type === SearchResultType.Command) {
      const action = result.metadata?.action;
      if (typeof action === 'function') {
        action();
      }
    } else if (result.type === SearchResultType.Document || result.type === SearchResultType.Extract) {
      const docId = result.type === SearchResultType.Extract ? result.metadata?.documentId : result.id;
      if (!docId) return;
      openDocumentInTab(docId, {
        highlightQuery: result.metadata?.highlightQuery,
        initialJump: result.metadata?.primaryHit?.location,
      });
    }
  }, [addTab]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const openDocumentInTab = useCallback((documentId: string, options?: { highlightQuery?: string; initialJump?: ExactSearchHitLocation }) => {
    const doc = documentsRef.current.find(d => d.id === documentId);
    const jumpRequestId = options?.initialJump ? `${Date.now()}-${Math.random().toString(36).slice(2)}` : undefined;
    if (doc) {
      addTab({
        title: doc.title,
        icon: doc.fileType === "pdf" ? <FileText className="w-4 h-4 text-red-500" /> 
          : doc.fileType === "epub" ? <BookOpen className="w-4 h-4 text-blue-500" /> 
          : doc.fileType === "youtube" ? <Youtube className="w-4 h-4 text-red-600" /> 
          : <FileText className="w-4 h-4 text-muted-foreground" />,
        type: "document-viewer",
        content: DocumentViewer,
        closable: true,
        data: {
          documentId: doc.id,
          highlightQuery: options?.highlightQuery,
          initialJump: options?.initialJump,
          jumpRequestId,
          autoPlay: options?.initialJump?.kind === "youtube" || options?.initialJump?.kind === "audio",
        },
      });
    } else {
      // Document might not be in cache yet (just imported), reload and retry
      loadDocuments().then(() => {
        const freshDoc = useDocumentStore.getState().documents.find(d => d.id === documentId);
        if (freshDoc) {
          addTab({
            title: freshDoc.title,
            icon: freshDoc.fileType === "pdf" ? <FileText className="w-4 h-4 text-red-500" /> 
              : freshDoc.fileType === "epub" ? <BookOpen className="w-4 h-4 text-blue-500" /> 
              : freshDoc.fileType === "youtube" ? <Youtube className="w-4 h-4 text-red-600" /> 
              : <FileText className="w-4 h-4 text-muted-foreground" />,
            type: "document-viewer",
            content: DocumentViewer,
            closable: true,
            data: {
              documentId: freshDoc.id,
              highlightQuery: options?.highlightQuery,
              initialJump: options?.initialJump,
              jumpRequestId,
              autoPlay: options?.initialJump?.kind === "youtube" || options?.initialJump?.kind === "audio",
            },
          });
        }
      });
    }
  }, [addTab, loadDocuments]);

  useEffect(() => {
    return registerCommandPaletteOpenEvents(
      setCommandPaletteOpen,
      () => useUIStore.getState().commandPaletteOpen
    );
  }, [setCommandPaletteOpen]);

  return (
    <GlobalSearch
      onSearch={handleSearch}
      onResultClick={handleResultClick}
      onNavigateToDocument={openDocumentInTab}
      hideTrigger={true}
      isOpen={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
    />
  );
}
