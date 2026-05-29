/* eslint-disable jsx-a11y/prefer-tag-over-role */
/**
 * Global search system
 * Fast, full-text search across all content types
 * Enhanced with URL import capability
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Search, X, Clock, Star, SlidersHorizontal, Link2 } from "lucide-react";
import { useURLDetector, URLType } from "../../hooks/useURLDetector";
import { useURLMetadata, useURLImport, useDuplicateCheck } from "../../hooks/useURLMetadata";
import { ImportPreview, type ImportOptions } from "../import/ImportPreview";
import { useToast } from "../../components/common/Toast";
import type { SearchHit } from "../../types/searchHit";
import { dispatchCommandPaletteOpen, isCommandPaletteOpenShortcut } from "../../utils/commandPaletteShortcut";

/**
 * Search result types
 */
export enum SearchResultType {
  Document = "document",
  Extract = "extract",
  Flashcard = "flashcard",
  Category = "category",
  Tag = "tag",
  Command = "command",
}

/**
 * Search result
 */
export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  content?: string;
  excerpt?: string;
  highlights?: string[];
  score: number;
  metadata?: {
    documentId?: string;
    category?: string;
    tags?: string[];
    modifiedAt?: Date;
    createdAt?: Date;
    fileType?: string;
    transcriptMatch?: boolean;
    highlightQuery?: string;
    primaryHit?: SearchHit;
    secondaryHits?: SearchHit[];
    action?: () => void | Promise<void>;
    sectionId?: string;
    targetPath?: string;
    resultKind?: "section" | "command";
  };
}

/**
 * Search query
 */
export interface SearchQuery {
  query: string;
  types?: SearchResultType[];
  categories?: string[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  operators?: SearchOperator[];
}

/**
 * Search operator
 */
export interface SearchOperator {
  type: "and" | "or" | "not" | "phrase" | "wildcard" | "fuzzy";
  value: string;
}

/**
 * Saved search
 */
export interface SavedSearch {
  id: string;
  name: string;
  query: SearchQuery;
  createdAt: Date;
  lastUsed?: Date;
}

/**
 * Global search component
 */
export function GlobalSearch({
  onSearch,
  onResultClick,
  onNavigateToDocument,
  recentSearches = [],
  savedSearches = [],
  onSaveSearch,
  hideTrigger = false,
  isOpen: controlledOpen,
  onOpenChange,
}: {
  onSearch: (query: SearchQuery) => Promise<SearchResult[]>;
  onResultClick: (result: SearchResult) => void;
  onNavigateToDocument?: (documentId: string) => void;
  recentSearches?: string[];
  savedSearches?: SavedSearch[];
  onSaveSearch?: (name: string, query: SearchQuery) => void;
  hideTrigger?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = controlledOpen ?? uncontrolledOpen;
  const setIsOpen = useCallback((open: boolean) => {
    onOpenChange?.(open);
    if (controlledOpen === undefined) {
      setUncontrolledOpen(open);
    }
  }, [controlledOpen, onOpenChange]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    types: SearchResultType[];
    categories: string[];
    tags: string[];
  }>({
    types: [],
    categories: [],
    tags: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const selectedResultRef = useRef<HTMLDivElement | null>(null);
  const latestSearchRequestRef = useRef(0);

  // URL detection and import state
  const urlDetection = useURLDetector(query);
  const { data: urlMetadata, isLoading: isMetadataLoading, error: metadataError } = useURLMetadata(
    urlDetection.type,
    urlDetection.url,
    { debounceMs: 500, enabled: urlDetection.isURL }
  );
  const { importURL, isImporting } = useURLImport();
  const duplicateCheck = useDuplicateCheck(urlDetection.type, urlDetection.url);
  const toast = useToast();
  const [importOptions, setImportOptions] = useState<ImportOptions>({ tags: [], collectionId: undefined });

  const isURLMode = urlDetection.isURL && urlDetection.type !== URLType.Unknown;

  // Debounced search
  const debouncedSearch = useMemo(
    () =>
      debounce(async (searchQuery: SearchQuery) => {
        const requestId = ++latestSearchRequestRef.current;
        setIsSearching(true);
        try {
          const searchResults = await onSearch(searchQuery);
          if (requestId !== latestSearchRequestRef.current) {
            return;
          }
          setResults(searchResults);
          setSelectedIndex(0);
        } finally {
          if (requestId === latestSearchRequestRef.current) {
            setIsSearching(false);
          }
        }
      }, 150),
    [onSearch]
  );

  // Update search when query or filters change (skip when in URL mode)
  useEffect(() => {
    if (isURLMode) {
      // Don't search when URL is detected
      latestSearchRequestRef.current += 1;
      setResults([]);
      setIsSearching(false);
      return;
    }

    if (query.trim()) {
      const searchQuery: SearchQuery = {
        query: query.trim(),
        types: filters.types.length > 0 ? filters.types : undefined,
        categories: filters.categories.length > 0 ? filters.categories : undefined,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
      };
      debouncedSearch(searchQuery);
    } else if (results.length > 0) {
      latestSearchRequestRef.current += 1;
      setResults([]);
      setIsSearching(false);
    }
  }, [query, filters, debouncedSearch, isURLMode]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || results.length === 0) return;

    setSelectedIndex((current) => Math.max(0, Math.min(current, results.length - 1)));
  }, [isOpen, results.length]);

  useEffect(() => {
    if (!isOpen || isURLMode) return;

    selectedResultRef.current?.scrollIntoView?.({
      block: "nearest",
    });
  }, [isOpen, isURLMode, selectedIndex, results]);

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      onResultClick(result);
      setIsOpen(false);
      setQuery("");
      setResults([]);
    },
    [onResultClick, setIsOpen]
  );

  const handleURLImport = useCallback(async (options: ImportOptions) => {
    if (!urlDetection.isURL) return;

    try {
      const result = await importURL(urlDetection.type, urlDetection.url, {
        tags: options.tags,
        collectionId: options.collectionId,
      });

      // Get document ID from result (structure varies by import type)
   
      const documentId = (result as any)?.document_id || (result as any)?.id;

      const title = urlMetadata
        ? (urlDetection.type === URLType.YouTube
   
            ? `Imported: ${(urlMetadata as any).title}`
            : urlDetection.type === URLType.RSSFeed
   
            ? `Subscribed to: ${(urlMetadata as any).title}`
   
            : `Imported: ${(urlMetadata as any).title}`)
        : `Imported: ${urlDetection.url}`;

      toast.success(title, "Click to view", {
        action: {
          label: "Open",
          onClick: () => {
            if (documentId && onNavigateToDocument) {
              onNavigateToDocument(documentId);
            }
            setIsOpen(false);
          },
        },
   
      } as any);

      // Clear for next import and refocus input
      setQuery("");
      setImportOptions({ tags: [], collectionId: undefined });

      // Refocus input for next import
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      toast.error(
        "Import failed",
        err instanceof Error ? err.message : "Unknown error"
      );
    }
  }, [urlDetection, urlMetadata, importURL, toast, setIsOpen, onNavigateToDocument]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) {
        if (isCommandPaletteOpenShortcut(e)) {
          e.preventDefault();
          dispatchCommandPaletteOpen();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (results.length > 0) {
            setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (results.length > 0) {
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
          }
          break;
        case "Enter":
          e.preventDefault();
          if (isURLMode && urlDetection.isURL && !isImporting) {
            handleURLImport(importOptions);
          } else if (results[selectedIndex]) {
            handleResultClick(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          if (isURLMode) {
            // Clear URL and return to search mode
            setQuery("");
            setResults([]);
          } else {
            setIsOpen(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, setIsOpen, isURLMode, urlMetadata, isImporting, importOptions, handleURLImport, handleResultClick]);

  const toggleTypeFilter = useCallback((type: SearchResultType) => {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ types: [], categories: [], tags: [] });
  }, []);

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.categories.length > 0 ||
    filters.tags.length > 0;

  return (
    <>
      {/* Trigger Button */}
      {!hideTrigger && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-md hover:bg-muted transition-colors"
        >
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Search...</span>
          <kbd className="ml-auto px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded">
            ⌘K
          </kbd>
        </button>
      )}

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 animate-glass-fade-in">
          {/* Backdrop with blur */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsOpen(false)}
          />

          {/* Search Panel with glass styling */}
          <div
            className="relative w-full max-w-2xl glass-panel-heavy animate-glass-scale-in overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
          >
            {/* Accessibility announcements */}
            <output
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {isURLMode && !isMetadataLoading && "URL detected. Press Enter to import."}
              {isImporting && "Importing..."}
            </output>

            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 glass-divider">
              {isURLMode ? (
                <Link2 className="w-5 h-5 text-primary-400" />
              ) : (
                <Search className="w-5 h-5 text-muted-foreground" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isURLMode ? "Press Enter to import..." : "Search documents, extracts, flashcards... or paste a URL"}
                className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="p-1.5 glass-button rounded-lg"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-all ${
                  hasActiveFilters
                    ? "bg-primary-400/20 text-primary-300 backdrop-blur-sm"
                    : "glass-button"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="p-4 glass-panel-light">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Filters</span>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-primary-300 hover:text-primary-200 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Type Filters */}
                <div className="mb-3">
                  <span className="text-xs text-muted-foreground mb-1 block">
                    Content Type
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(SearchResultType).map((type) => (
                      <button
                        key={type}
                        onClick={() => toggleTypeFilter(type)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                          filters.types.includes(type)
                            ? "bg-primary-400/30 text-primary-200 backdrop-blur-sm border border-primary-400/30"
                            : "glass-button text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            <div
              ref={resultsRef}
              className="max-h-96 overflow-y-auto"
            >
              {/* URL Import Mode */}
              {isURLMode ? (
                <section
                  aria-label="URL import preview"
                  aria-busy={isMetadataLoading}
                  className="transition-opacity duration-200"
                >
                  <ImportPreview
                    urlType={urlDetection.type}
                    url={urlDetection.url}
                    data={urlMetadata}
                    isLoading={isMetadataLoading}
                    error={metadataError}
                    onImport={handleURLImport}
                    isImporting={isImporting}
                    onOptionsChange={setImportOptions}
                    duplicateCheck={duplicateCheck}
                    onOpenExisting={onNavigateToDocument}
                  />
                </section>
              ) : !query ? (
                <div className="p-6">
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Recent
                      </h3>
                      <div className="space-y-1">
                        {recentSearches.slice(0, 5).map((search, i) => (
                          <button
                            key={i}
                            onClick={() => setQuery(search)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded text-left"
                          >
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{search}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Saved Searches */}
                  {savedSearches.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Saved Searches
                      </h3>
                      <div className="space-y-1">
                        {savedSearches.map((saved) => (
                          <button
                            key={saved.id}
                            onClick={() => setQuery(saved.query.query)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded text-left"
                          >
                            <Star className="w-4 h-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{saved.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {saved.query.query}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : isSearching ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-2 text-sm">Searching...</p>
                </div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No results found</p>
                  <p className="text-xs mt-1">Try different keywords or filters</p>
                </div>
              ) : (
                <div>
                  {results.map((result, index) => (
                    <div
                      key={result.id}
                      ref={index === selectedIndex ? selectedResultRef : undefined}
                      role="button"
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        // Prevent input blur on click; keep palette focus behavior stable.
                        e.preventDefault();
                      }}
                      onClick={() => handleResultClick(result)}
                      className={`group relative w-full flex items-start gap-3 px-4 py-3 transition-colors text-left cursor-pointer ${
                        index === selectedIndex
                          ? "bg-primary-400/10 backdrop-blur-sm border-l-2 border-primary-400"
                          : "hover:bg-glass-100"
                      }`}
                    >
                      {/* Type Icon */}
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center ${
                          result.type === SearchResultType.Document
                            ? "bg-blue-500/10 text-blue-500"
                            : result.type === SearchResultType.Extract
                            ? "bg-purple-500/10 text-purple-500"
                            : result.type === SearchResultType.Flashcard
                            ? "bg-green-500/10 text-green-500"
                            : "bg-muted"
                        }`}
                      >
                        <span className="text-xs font-semibold uppercase">
                          {result.type[0]}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {result.title}
                          {result.highlights && result.highlights.length > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({result.highlights.length} matches)
                            </span>
                          )}
                        </p>

                        {result.excerpt && (
                          <p
                            className="text-sm text-muted-foreground line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: result.excerpt }}
                          />
                        )}

                        <div className="flex items-center gap-2 mt-1">
                          {result.metadata?.transcriptMatch && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">
                              Transcript
                            </span>
                          )}
                          {result.metadata?.category && (
                            <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                              {result.metadata.category}
                            </span>
                          )}
                          {result.metadata?.tags?.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-1.5 py-0.5 bg-accent text-accent-foreground rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>

                        {/* More matches (hover) */}
                        {result.metadata?.secondaryHits && result.metadata.secondaryHits.length > 0 && (
                          <div className="mt-2 hidden group-hover:block">
                            <div className="text-[11px] text-muted-foreground mb-1">
                              More matches in this document
                            </div>
                            <div className="space-y-1">
                              {result.metadata.secondaryHits.slice(0, 5).map((hit) => (
                                <button
                                  key={hit.id}
                                  type="button"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Forward a synthetic result that uses the chosen hit as the primary hit.
                                    const synthetic: SearchResult = {
                                      ...result,
                                      metadata: {
                                        ...result.metadata,
                                        primaryHit: hit,
                                      },
                                    };
                                    handleResultClick(synthetic);
                                  }}
                                  className="w-full text-left px-2 py-1 rounded bg-background/60 border border-border hover:bg-background transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {hit.label && (
                                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                        {hit.label}
                                      </span>
                                    )}
                                    {hit.excerptHtml ? (
                                      <span
                                        className="text-[12px] text-muted-foreground line-clamp-1"
                                        dangerouslySetInnerHTML={{ __html: hit.excerptHtml }}
                                      />
                                    ) : (
                                      <span className="text-[12px] text-muted-foreground line-clamp-1">
                                        Jump to match
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Score */}
                      <div className="flex-shrink-0 text-xs text-muted-foreground">
                        {Math.round(result.score * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 glass-panel-light">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  {isURLMode ? (
                    <>
                      <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 glass-button rounded text-[10px]">
                          ↵
                        </kbd>
                        Import
                      </span>
                      <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 glass-button rounded text-[10px]">
                          ESC
                        </kbd>
                        Clear
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 glass-button rounded text-[10px]">
                          ↑↓
                        </kbd>
                        Navigate
                      </span>
                      <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 glass-button rounded text-[10px]">
                          ↵
                        </kbd>
                        Select
                      </span>
                      <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 glass-button rounded text-[10px]">
                          ESC
                        </kbd>
                        Close
                      </span>
                    </>
                  )}
                </div>
                {!isURLMode && query && (
                  <button
                    onClick={() => {
                      if (onSaveSearch) {
                        const searchQuery: SearchQuery = {
                          query: query.trim(),
                          types: filters.types.length > 0 ? filters.types : undefined,
                        };
                        onSaveSearch(query.trim(), searchQuery);
                      }
                    }}
                    className="hover:text-foreground flex items-center gap-1 glass-button px-2 py-1 rounded-lg transition-colors"
                  >
                    <Star className="w-3 h-3" />
                    Save search
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Debounce utility
 */
function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
