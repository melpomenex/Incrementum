import { useState } from "react";
import {
  ArrowsClockwise,
  BookOpen,
  CheckCircle,
  CircleNotch,
  Download,
  Globe,
  HardDrives,
  MagnifyingGlass,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  searchBooks,
  downloadBook,
  getFormatDisplayName,
  getAnnasArchiveUrl, // v3-binding-fix
  type BookSearchResult,
  type BookFormat,
} from "../../api/anna-archive";
import { importDocument } from "../../api/documents";

interface AnnaArchiveSearchProps {
  onImportComplete?: (path: string) => void;
  onClose?: () => void;
}

const AVAILABLE_FORMATS: BookFormat[] = ["pdf", "epub", "mobi", "azw3"];

interface SearchError {
  message: string;
  type: "network" | "parse" | "not_found" | "unknown";
  solutions: string[];
}

export function AnnaArchiveSearch({ onImportComplete, onClose }: AnnaArchiveSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SearchError | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<BookFormat>("epub");
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [importedBookIds, setImportedBookIds] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const searchResults = await searchBooks(query, 20);
      
      if (searchResults.length === 0) {
        setError({
          message: `No books found for "${query}"`,
          type: "not_found",
          solutions: [
            "Try different keywords or a shorter search term",
            "Search by author name instead of book title",
            "Check your spelling or try alternative spellings",
            "Try searching by ISBN if you have it",
            "Some books may not be available in the archive",
          ],
        });
      } else {
        setResults(searchResults);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to search books";
      setError(analyzeError(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (book: BookSearchResult, format: BookFormat) => {
    setDownloadingBookId(book.id);
    setError(null);

    try {
      // Download to temp directory (default behavior)
      const downloadResult = await downloadBook(book.id, format);

      const importedDoc = await importDocument(downloadResult.file_path);

      // Mark as imported
      setImportedBookIds((prev) => new Set(prev).add(book.id));

      onImportComplete?.(importedDoc.filePath);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to download book";
      setError(analyzeError(errorMessage));
    } finally {
      setDownloadingBookId(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleRetry = () => {
    if (query.trim()) {
      handleSearch();
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">MagnifyingGlass Anna's Archive</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            MagnifyingGlass 60M+ books from Anna's Archive mirrors
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>

      {/* MagnifyingGlass Input */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search by title, author, ISBN..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <CircleNotch className="w-4 h-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <MagnifyingGlass className="w-4 h-4" />
              MagnifyingGlass
            </>
          )}
        </button>
      </div>

      {/* Format Filter */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">Preferred format:</span>
        <div className="flex gap-1">
          {AVAILABLE_FORMATS.map((format) => (
            <button
              key={format}
              onClick={() => setSelectedFormat(format)}
              className={`px-3 py-1 text-xs rounded ${
                selectedFormat === format
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {getFormatDisplayName(format)}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {error.type === "network" && <HardDrives className="w-5 h-5 text-destructive" />}
              {error.type === "not_found" && <MagnifyingGlass className="w-5 h-5 text-destructive" />}
              {error.type === "parse" && <WarningCircle className="w-5 h-5 text-destructive" />}
              {error.type === "unknown" && <WarningCircle className="w-5 h-5 text-destructive" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive mb-2">{error.message}</p>
              
              {error.solutions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Suggested solutions:</p>
                  <ul className="space-y-1">
                    {error.solutions.map((solution, index) => (
                      <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{solution}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error.type === "network" && (
                <button
                  onClick={handleRetry}
                  className="mt-3 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs hover:opacity-90 flex items-center gap-1.5 w-fit"
                >
                  <ArrowsClockwise className="w-3.5 h-3.5" />
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Found {results.length} {results.length === 1 ? "result" : "results"}
          </p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {results.map((book) => (
              <BookResultCard
                key={book.id}
                book={book}
                selectedFormat={selectedFormat}
                isDownloading={downloadingBookId === book.id}
                isImported={importedBookIds.has(book.id)}
                onDownload={(format) => handleDownload(book, format)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && results.length === 0 && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">
            {query
              ? "No results found. Try a different search term."
              : "Enter a search term to find books."}
          </p>
          {!query && (
            <p className="text-xs mt-2 max-w-sm mx-auto">
              Anna's Archive searches through Library Genesis, Z-Library, Sci-Hub, and more. 
              MagnifyingGlass by title, author, or ISBN to find and download books.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Analyze error message and return structured error info with solutions
 */
function analyzeError(message: string): SearchError {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes("python") || lowerMsg.includes("playwright") || lowerMsg.includes("chromium")) {
    return {
      message: "Book download requires Python with Playwright",
      type: "unknown",
      solutions: [
        "Install Python 3: https://www.python.org/downloads/",
        "Install Playwright: pip install playwright",
        "Install Chromium: playwright install chromium",
      ],
    };
  }

  if (lowerMsg.includes("failed to fetch") || 
      lowerMsg.includes("network error") ||
      lowerMsg.includes("connection") ||
      lowerMsg.includes("timeout") ||
      lowerMsg.includes("dns") ||
      lowerMsg.includes("ssl") ||
      lowerMsg.includes("certificate")) {
    return {
      message: "Unable to connect to book archive servers",
      type: "network",
      solutions: [
        "Check your internet connection",
        "The archive servers may be temporarily down - try again in a few minutes",
        "Some networks block archive sites - try using a VPN",
        "If using a VPN, try connecting to a different server location",
        "Check if your firewall or antivirus is blocking the connection",
      ],
    };
  }

  if (lowerMsg.includes("parse") || 
      lowerMsg.includes("html") ||
      lowerMsg.includes("json") ||
      lowerMsg.includes("invalid response")) {
    return {
      message: "Failed to parse search results from the archive",
      type: "parse",
      solutions: [
        "The archive server may have changed their layout - try again later",
        "The server may be experiencing issues - try again in a few minutes",
        "Try a simpler search query with fewer special characters",
      ],
    };
  }

  if (lowerMsg.includes("not found") || 
      lowerMsg.includes("no results") ||
      lowerMsg.includes("empty")) {
    return {
      message: message,
      type: "not_found",
      solutions: [
        "Try different keywords or a shorter search term",
        "Search by author name instead of book title",
        "Check your spelling or try alternative spellings",
        "Try searching by ISBN if you have it",
      ],
    };
  }

  return {
    message: message || "An unexpected error occurred",
    type: "unknown",
    solutions: [
      "Try again in a few moments",
      "If the problem persists, try restarting the application",
      "Check your internet connection",
    ],
  };
}

interface BookResultCardProps {
  book: BookSearchResult;
  selectedFormat: BookFormat;
  isDownloading: boolean;
  isImported: boolean;
  onDownload: (format: BookFormat) => void;
}

function BookResultCard({ book, selectedFormat, isDownloading, isImported, onDownload }: BookResultCardProps) {
  // Generate view URL using the book's MD5
  const viewUrl = book.md5 
    ? getAnnasArchiveUrl(book.md5)
    : null;

  return (
    <div className={`bg-background border border-border rounded-md p-4 hover:bg-muted/30 transition-colors ${isImported ? "border-green-500/30 bg-green-500/5" : ""}`}>
      <div className="flex gap-4">
        {/* Cover Image */}
        {book.cover_url ? (
          <div className="relative">
            <img
              src={book.cover_url}
              alt={book.title}
              className="w-20 h-28 object-cover rounded flex-shrink-0"
              onError={(e) => {
                // Hide image on error and show placeholder
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  const placeholder = document.createElement('div');
                  placeholder.className = 'w-20 h-28 bg-muted rounded flex items-center justify-center flex-shrink-0';
                  placeholder.innerHTML = isImported 
                    ? '<svg class="w-8 h-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                    : '<svg class="w-8 h-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>';
                  parent.appendChild(placeholder);
                }
              }}
            />
            {isImported && (
              <div className="absolute inset-0 bg-green-500/20 rounded flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            )}
          </div>
        ) : (
          <div className="w-20 h-28 bg-muted rounded flex items-center justify-center flex-shrink-0 relative">
            {isImported ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : (
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
        )}

        {/* Book Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground line-clamp-2 mb-1">{book.title}</h3>
          {book.author && (
            <p className="text-sm text-muted-foreground mb-1">by {book.author}</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
            {book.year && <span>{book.year}</span>}
            {book.publisher && <span>• {book.publisher}</span>}
            {book.language && <span>• {book.language}</span>}
            {book.file_size && <span>• {book.file_size}</span>}
          </div>
          {book.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{book.description}</p>
          )}

          {/* Available Formats */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">Formats:</span>
            <div className="flex gap-1 flex-wrap">
              {book.formats.map((format) => (
                <button
                  key={format}
                  onClick={() => !isImported && !isDownloading && onDownload(format)}
                  disabled={isImported || isDownloading}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    format === selectedFormat
                      ? "bg-primary/10 text-primary font-medium border border-primary/20"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  } ${isImported || isDownloading ? "cursor-default" : "cursor-pointer"}`}
                >
                  {getFormatDisplayName(format)}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {isImported ? (
              <div className="px-3 py-1.5 bg-green-500/10 text-green-500 rounded text-sm flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                Imported
              </div>
            ) : (
              <button
                onClick={() => onDownload(selectedFormat)}
                disabled={isDownloading || !book.formats.includes(selectedFormat)}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDownloading ? (
                  <>
                    <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download {book.formats.includes(selectedFormat) ? getFormatDisplayName(selectedFormat) : ""}
                  </>
                )}
              </button>
            )}
            {viewUrl && (
              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-muted text-muted-foreground rounded text-sm hover:bg-muted/80 flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                View Source
              </a>
            )}
          </div>
          
          {!book.formats.includes(selectedFormat) && !isImported && (
            <p className="text-xs text-amber-600 mt-1.5">
              {getFormatDisplayName(selectedFormat)} not available for this book. Select a different format above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
