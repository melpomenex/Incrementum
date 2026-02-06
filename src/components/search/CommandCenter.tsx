import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GlobalSearch, SearchResult, SearchQuery, SearchResultType } from "./GlobalSearch";
import { useDocumentStore } from "../../stores/documentStore";
import { useTabsStore } from "../../stores/tabsStore";
import { useStudyDeckStore } from "../../stores/studyDeckStore";
import { useUIStore } from "../../stores/uiStore";
import { useExtractStore } from "../../stores/extractStore";
import { matchesDeckTags } from "../../utils/studyDecks";
import { calculateRelevanceScore, extractSearchTerms, fuzzyMatch, highlightSearchTerms } from "./SearchUtils";
import { extractDocumentText, getDocuments as fetchDocuments } from "../../api/documents";
import { isTauri } from "../../lib/tauri";
import {
  DocumentViewer,
  DashboardTab,
  QueueTab,
  ReviewTab,
  DocumentsTab,
  AnalyticsTab,
  SettingsTab
} from "../../components/tabs/TabRegistry";
import { Command, CommandCategory, getDefaultCommands } from "../common/CommandPalette";
import {
  Plus,
  BookOpen,
  Layers,
  BarChart3,
  Settings,
  Home,
  Zap
} from "lucide-react";
import type { Document } from "../../types/document";
import type { StudyDeck } from "../../types/study-decks";
import type { TabsState } from "../../stores/tabsStore";
import type { UIState } from "../../stores/uiStore";
import type { StudyDeckState } from "../../stores/studyDeckStore";
import type { Extract } from "../../types/document";
import { fetchYouTubeTranscript } from "../../api/youtube";
import * as documentsApi from "../../api/documents";

type SearchHitLocation =
  | { kind: "pdf"; pageNumber: number }
  | { kind: "epub"; cfi: string }
  | { kind: "html"; scrollPercent: number }
  | { kind: "youtube"; timeSeconds: number; segmentId?: string };

type SearchHit = {
  id: string;
  location: SearchHitLocation;
  excerptHtml?: string;
  label?: string;
};

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

// Stable selectors defined outside component to avoid infinite re-renders
const selectAddTab = (state: TabsState) => state.addTab;
const selectActiveDeckId = (state: StudyDeckState) => state.activeDeckId;
const selectCommandPaletteOpen = (state: UIState) => state.commandPaletteOpen;
const selectSetCommandPaletteOpen = (state: UIState) => state.setCommandPaletteOpen;
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
  const activeDeckId = useStudyDeckStore(selectActiveDeckId);
  const commandPaletteOpen = useUIStore(selectCommandPaletteOpen);
  const setCommandPaletteOpen = useUIStore(selectSetCommandPaletteOpen);
  const extracts = useExtractStore(selectExtracts);
  const extractsLoading = useExtractStore(selectExtractsLoading);
  const loadExtracts = useExtractStore(selectLoadExtracts);
  const indexedDocsRef = useRef<Set<string>>(new Set());
  const indexingRef = useRef(false);
  const documentsSnapshotRef = useRef<Document[]>([]);
  const documentsFetchInFlight = useRef<Promise<Document[]> | null>(null);
  const transcriptCacheRef = useRef<Map<string, { text: string; lower: string }>>(new Map());
  const transcriptFetchInFlightRef = useRef<Set<string>>(new Set());
  const htmlTextCacheRef = useRef<Map<string, { text: string; lower: string }>>(new Map());
  const epubSearchCacheRef = useRef<Map<string, Map<string, SearchHit[]>>>(new Map());

  useEffect(() => {
    if (!documentsLoading && documents.length === 0) {
      void loadDocuments();
    }
  }, [documents.length, documentsLoading, loadDocuments]);

  useEffect(() => {
    if (documents.length > 0) {
      documentsSnapshotRef.current = documents;
    }
  }, [documents]);

  useEffect(() => {
    if (commandPaletteOpen && !extractsLoading && extracts.length === 0) {
      void loadExtracts();
    }
  }, [commandPaletteOpen, extracts.length, extractsLoading, loadExtracts]);

  useEffect(() => {
    if (!commandPaletteOpen || documents.length === 0) return;
    if (indexingRef.current) return;
    if (!isTauri()) return;

    const missingContent = documents.filter((doc) =>
      !indexedDocsRef.current.has(doc.id) &&
      (!doc.content || doc.content.trim().length === 0) &&
      (doc.fileType === "pdf" || doc.fileType === "epub" || doc.fileType === "html")
    );
    if (missingContent.length === 0) return;

    let cancelled = false;
    indexingRef.current = true;
    const run = async () => {
      for (const doc of missingContent) {
        try {
          await extractDocumentText(doc.id);
        } catch (error) {
          console.warn("[CommandCenter] Failed to extract document text", doc.id, error);
        } finally {
          indexedDocsRef.current.add(doc.id);
        }
      }
    };
    void run().finally(() => {
      if (!cancelled) {
        indexingRef.current = false;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [commandPaletteOpen, documents]);

  const activeDeck = useMemo(
    () => decks.find((item) => item.id === activeDeckId) ?? null,
    [decks, activeDeckId]
  );
  const activeDeckTags = useMemo(
    () => activeDeck?.tagFilters ?? [],
    [activeDeck]
  );
  const shouldFilterByDeck = false;

  const handleSearch = useCallback(async (query: SearchQuery): Promise<SearchResult[]> => {
    const term = query.query.toLowerCase().trim();
    const results: SearchResult[] = [];
    if (!term) return results;

    const queryTerms = extractSearchTerms(query.query)
      .map((item) => item.toLowerCase().trim())
      .filter(Boolean);
    const meaningfulTerms = queryTerms.filter(isMeaningfulTerm);
    const searchTerms = meaningfulTerms.length > 0 ? meaningfulTerms : [term];
    const allowContentSearch = meaningfulTerms.length > 0;

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
    const maxDocsToScan = isWeb ? 500 : Infinity;
    const maxExtractsToScan = isWeb ? 1000 : Infinity;
    const maxTranscriptFetches = isWeb ? 5 : 20;
    let transcriptFetches = 0;
    const maxEpubSearches = isWeb ? 1 : 3;
    let epubSearches = 0;

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

    const getEpubHits = async (doc: Document, rawQuery: string): Promise<SearchHit[]> => {
      const cachedForDoc = epubSearchCacheRef.current.get(doc.id);
      if (cachedForDoc?.has(rawQuery)) {
        return cachedForDoc.get(rawQuery) ?? [];
      }

      if (epubSearches >= maxEpubSearches) return [];
      epubSearches += 1;

      try {
        const base64 = await documentsApi.readDocumentFile(doc.filePath);
        if (!base64) return [];
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const { default: ePub } = await import("epubjs");
        const book: any = ePub(bytes.buffer);
        await book.ready;
        if (typeof book.search !== "function") return [];
        const found: any[] = await book.search(rawQuery);
        const hits: SearchHit[] = (found || []).slice(0, 6).map((item, i) => {
          const cfi = item?.cfi || item?.cfiRange || item?.cfiRange?.start || item?.cfiRange;
          const excerptText = (item?.excerpt || item?.text || "").toString();
          const { excerpt } = highlightSearchTerms(excerptText || rawQuery, rawQuery, 200);
          return {
            id: `epub-hit-${doc.id}-${i}`,
            location: { kind: "epub", cfi: String(cfi) },
            label: "EPUB",
            excerptHtml: excerpt,
          };
        }).filter((hit) => !!(hit.location as any)?.cfi);

        if (!epubSearchCacheRef.current.has(doc.id)) {
          epubSearchCacheRef.current.set(doc.id, new Map());
        }
        epubSearchCacheRef.current.get(doc.id)!.set(rawQuery, hits);

        try {
          book.destroy?.();
        } catch {
          // ignore
        }

        return hits;
      } catch (error) {
        console.warn("[CommandCenter] EPUB search failed", doc.id, error);
        return [];
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

    let docsForSearch = documents.length > 0 ? documents : documentsSnapshotRef.current;
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
    const navigationCommands: Command[] = [
      {
        id: "nav-dashboard",
        label: "Go to Dashboard",
        description: "Navigate to the dashboard",
        icon: <Home className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => addTab({
          title: "Dashboard",
          icon: "📊",
          type: "dashboard",
          content: DashboardTab,
          closable: false,
        }),
        keywords: ["home", "main"],
      },
      {
        id: "nav-documents",
        label: "Go to Documents",
        description: "View all documents",
        icon: <BookOpen className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => addTab({
          title: "Documents",
          icon: "📂",
          type: "documents",
          content: DocumentsTab,
          closable: true,
        }),
        keywords: ["library", "files"],
      },
      {
        id: "nav-queue",
        label: "Go to Queue",
        description: "View reading queue",
        icon: <Layers className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => addTab({
          title: "Queue",
          icon: "📚",
          type: "queue",
          content: QueueTab,
          closable: true,
        }),
        keywords: ["list", "reading"],
      },
      {
        id: "nav-analytics",
        label: "Go to Statistics",
        description: "View learning statistics",
        icon: <BarChart3 className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => addTab({
          title: "Statistics",
          icon: "📈",
          type: "analytics",
          content: AnalyticsTab,
          closable: true,
        }),
        keywords: ["stats", "progress"],
      },
      {
        id: "nav-settings",
        label: "Go to Settings",
        description: "View application settings",
        icon: <Settings className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => addTab({
          title: "Settings",
          icon: "⚙️",
          type: "settings",
          content: SettingsTab,
          closable: true,
        }),
        keywords: ["config", "preferences"],
      },
      {
        id: "nav-review",
        label: "Start Review",
        description: "Start a review session",
        icon: <Zap className="w-4 h-4" />,
        category: CommandCategory.Navigation,
        action: () => addTab({
          title: "Review",
          icon: "🧠",
          type: "review",
          content: ReviewTab,
          closable: true,
        }),
        keywords: ["review", "study"],
      },
    ];

    const allCommands = [...getDefaultCommands(), ...navigationCommands];

    const matchedCommands = allCommands.filter((cmd) => {
      const label = cmd.label.toLowerCase();
      const description = cmd.description?.toLowerCase() ?? "";
      const keywords = cmd.keywords?.map((keyword) => keyword.toLowerCase()) ?? [];
      const termMatch = matchesTerms(label, searchTerms) || matchesTerms(description, searchTerms);
      const keywordMatch = keywords.some((keyword) => matchesTerms(keyword, searchTerms));

      if (termMatch || keywordMatch) return true;
      return fuzzyMatches(label) || (description ? fuzzyMatches(description) : false);
    });

    matchedCommands.forEach(cmd => {
      results.push({
        id: `cmd-${cmd.id}`,
        type: SearchResultType.Command,
        title: cmd.label,
        excerpt: cmd.description,
        score: 1,
        metadata: {
          // Store the action in a way we can retrieve it
          action: cmd.action
        } as any
      });
    });

    // 2. Search Documents (grouped: one row per document)
    if (!query.types || query.types.includes(SearchResultType.Document)) {
      const scopedDocs = docsForSearch;
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

        // Transcript hits (YouTube)
        let transcriptMatch = false;
        if (allowContentSearch && doc.fileType === "youtube" && groupedDocs.size < maxResults) {
          const cached = transcriptCacheRef.current.get(doc.id);
          let transcriptText: string | null = cached?.text ?? null;
          let transcriptLower: string | null = cached?.lower ?? null;
          if (!cached && !transcriptFetchInFlightRef.current.has(doc.id) && transcriptFetches < maxTranscriptFetches) {
            transcriptFetchInFlightRef.current.add(doc.id);
            transcriptFetches += 1;
            try {
              const videoId = extractYouTubeId(doc.filePath);
              if (videoId) {
                const segments = await fetchYouTubeTranscript(videoId);
                if (segments.length > 0) {
                  const text = buildTranscriptText(segments);
                  if (text) {
                    const entry = { text, lower: text.toLowerCase() };
                    transcriptCacheRef.current.set(doc.id, entry);
                    transcriptText = entry.text;
                    transcriptLower = entry.lower;
                  }

                  // Build segment-level hits (timestamps)
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
                      location: { kind: "youtube", timeSeconds: seg.start, segmentId: `seg-${idx}` },
                      label: formatTimestamp(seg.start),
                      excerptHtml: excerpt,
                    });
                  });
                }
              }
            } catch (error) {
              console.warn("[CommandCenter] Failed to fetch YouTube transcript", doc.id, error);
            } finally {
              transcriptFetchInFlightRef.current.delete(doc.id);
            }
          } else if (cached && transcriptLower) {
            transcriptMatch = matchesTerms(transcriptLower, searchTerms);
          }

          if (transcriptLower) {
            transcriptMatch = matchesTerms(transcriptLower, searchTerms);
          }
        }

        // Text hits (PDF/HTML/Markdown/etc)
        if (allowContentSearch && doc.fileType !== "youtube") {
          for (const t of searchTerms) {
            if (hits.length >= 6) break;
            const occ = findAllOccurrences(contentLower, t, 6 - hits.length);
            occ.forEach((index, i) => {
              if (doc.fileType === "pdf") {
                const pageNum = buildPdfPageFromIndex(doc, index, Math.max(1, contentLower.length));
                hits.push({
                  id: `hit-${doc.id}-${t}-${index}`,
                  location: { kind: "pdf", pageNumber: pageNum },
                  label: `Page ${pageNum}`,
                  excerptHtml: excerptFromIndex(content, index, query.query),
                });
              } else if (doc.fileType === "epub") {
                // EPUB hits prefer real CFIs; fill later if we can.
                hits.push({
                  id: `hit-${doc.id}-${t}-${index}`,
                  location: { kind: "html", scrollPercent: clamp(Math.round((index / Math.max(1, contentLower.length)) * 100), 0, 100) },
                  label: "EPUB",
                  excerptHtml: excerptFromIndex(content, index, query.query),
                });
              } else if (doc.fileType === "html") {
                const pct = clamp(Math.round((index / Math.max(1, contentLower.length)) * 100), 0, 100);
                hits.push({
                  id: `hit-${doc.id}-${t}-${index}`,
                  location: { kind: "html", scrollPercent: pct },
                  label: `${pct}%`,
                  excerptHtml: excerptFromIndex(content, index, query.query),
                });
              } else {
                const pct = clamp(Math.round((index / Math.max(1, contentLower.length)) * 100), 0, 100);
                hits.push({
                  id: `hit-${doc.id}-${t}-${index}`,
                  location: { kind: "html", scrollPercent: pct },
                  label: `${pct}%`,
                  excerptHtml: excerptFromIndex(content, index, query.query),
                });
              }
            });
          }
        }

        // EPUB: upgrade hits to CFI-based when possible
        if (doc.fileType === "epub" && allowContentSearch && (contentMatch || titleMatch)) {
          const epubHits = await getEpubHits(doc, query.query);
          if (epubHits.length > 0) {
            hits.splice(0, hits.length, ...epubHits);
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
      for (const extract of extracts) {
        if (scanned >= maxExtractsToScan) break;
        scanned += 1;

        const content = extract.content ?? "";
        const contentLower = content.toLowerCase();
        if (!allowContentSearch || !matchesTerms(contentLower, searchTerms)) continue;

        const docId = extract.documentId;
        const parentDoc = documents.find((d) => d.id === docId);
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
          location: { kind: "pdf", pageNumber: pageNum },
          label: `Page ${pageNum}`,
          excerptHtml: excerpt,
        });
      }
    }

    // Materialize grouped results: one row per document.
    groupedDocs.forEach((entry) => {
      const doc = entry.doc;
      const sortedHits = entry.hits.slice(0);

      // Prefer YouTube transcript hits first, then extract hits, then others.
      sortedHits.sort((a, b) => {
        const ak = a.location.kind;
        const bk = b.location.kind;
        const pri = (k: string) => k === "youtube" ? 0 : k === "pdf" ? 1 : 2;
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
  }, [documents, extracts, addTab, activeDeck, shouldFilterByDeck]);

  const handleResultClick = useCallback((result: SearchResult) => {
    if (result.type === SearchResultType.Command) {
      const action = (result.metadata as any)?.action;
      if (typeof action === 'function') {
        action();
      }
    } else if (result.type === SearchResultType.Document || result.type === SearchResultType.Extract) {
      // Open document in tab
      // We need the full document object, find it in store
      const docId = result.type === SearchResultType.Extract
        ? (result.metadata as any)?.documentId
        : result.id;
      const doc = documents.find(d => d.id === docId);
      if (doc) {
        const primaryHit = (result.metadata as any)?.primaryHit as SearchHit | undefined;
        const highlightQuery = (result.metadata as any)?.highlightQuery as string | undefined;
        addTab({
          title: doc.title,
          icon: doc.fileType === "pdf" ? "📕" : doc.fileType === "epub" ? "📖" : doc.fileType === "youtube" ? "📺" : "📄",
          type: "document-viewer",
          content: DocumentViewer,
          closable: true,
          data: {
            documentId: doc.id,
            highlightQuery,
            initialJump: primaryHit?.location,
            autoPlay: primaryHit?.location.kind === "youtube",
          },
        });
      }
    }
  }, [documents, addTab]);

  useEffect(() => {
    const handleToggle = () => {
      const { commandPaletteOpen: isOpen } = useUIStore.getState();
      setCommandPaletteOpen(!isOpen);
    };

    window.addEventListener("command-palette-toggle", handleToggle as EventListener);
    return () => window.removeEventListener("command-palette-toggle", handleToggle as EventListener);
  }, [setCommandPaletteOpen]);

  return (
    <GlobalSearch
      onSearch={handleSearch}
      onResultClick={handleResultClick}
      hideTrigger={true}
      isOpen={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
    />
  );
}
