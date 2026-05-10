import { invokeCommand } from "../lib/tauri";

console.log('[AnnaArchive] Module initialized v3');

/**
 * Get the Anna's Archive URL for a book
 * 
 * @param md5 - The MD5 hash of the book
 * @returns Full URL to the book's page on Anna's Archive
 */
export const getAnnasArchiveUrl = (md5: string): string => {
  return `https://annas-archive.gl/md5/${md5}`;
};

/**
 * Get the cover image URL for a book
 * 
 * @param md5 - The MD5 hash of the book
 * @returns Full URL to the cover image
 */
export const getCoverImageUrl = (md5: string): string => {
  return `https://annas-archive.gl/covers/${md5}.jpg`;
};

export type BookFormat = "pdf" | "epub" | "mobi" | "azw3" | "djvu" | "cbz" | "cbr" | "zip" | "rtf";

export interface BookSearchResult {
  id: string;
  title: string;
  author?: string;
  year?: number;
  publisher?: string;
  language?: string;
  formats: BookFormat[];
  cover_url?: string;
  description?: string;
  isbn?: string;
  md5?: string;
  file_size?: string;
}

export interface DownloadProgress {
  book_id: string;
  progress: number;
  bytes_downloaded: number;
  total_bytes?: number;
  status: "Connecting" | "Downloading" | "Completed" | "Failed" | "Cancelled";
}

export interface DownloadResult {
  file_path: string;
  file_name: string;
  file_size: number;
}

/**
 * Search for books on Anna's Archive
 *
 * @param query - Search query (title, author, ISBN, etc.)
 * @param limit - Maximum number of results (default: 20, max: 100)
 * @returns Array of book search results
 */
export async function searchBooks(query: string, limit?: number): Promise<BookSearchResult[]> {
  return await invokeCommand<BookSearchResult[]>("search_books", {
    query,
    limit: limit ?? 20,
  });
}

/**
 * Download a book from Anna's Archive
 *
 * @param bookId - The MD5 hash of the book to download (used as ID)
 * @param format - The format to download (pdf, epub, etc.)
 * @param downloadPath - Optional: Where to save the downloaded file (default: temp directory)
 * @returns Download result with file path and metadata
 */
export async function downloadBook(
  bookId: string,
  format: BookFormat,
  downloadPath?: string
): Promise<DownloadResult> {
  return await invokeCommand<DownloadResult>("download_book", {
    bookId,
    format,
    downloadPath: downloadPath ?? "temp",
  });
}

/**
 * Get available Anna's Archive mirror domains
 *
 * @returns Array of mirror URLs
 */
export async function getAvailableMirrors(): Promise<string[]> {
  return await invokeCommand<string[]>("get_available_mirrors");
}

/**
 * Get suggested download path for a book
 *
 * @param book - The book to get the path for
 * @param format - The format being downloaded
 * @returns Suggested file path
 */
export function getSuggestedDownloadPath(book: BookSearchResult, format: BookFormat): string {
  // Create a safe filename from title and author
  const safeTitle = book.title.replace(/[^a-zA-Z0-9]/g, "_");
  const safeAuthor = book.author?.replace(/[^a-zA-Z0-9]/g, "_") ?? "unknown";

  // Create filename: Author - Title.format
  const filename = `${safeAuthor} - ${safeTitle}.${format}`;

  return filename;
}

/**
 * Format the file size for display
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Get display name for a book format
 *
 * @param format - The format code
 * @returns Display name
 */
export function getFormatDisplayName(format: BookFormat): string {
  const names: Record<BookFormat, string> = {
    pdf: "PDF",
    epub: "EPUB",
    mobi: "MOBI",
    azw3: "AZW3",
    djvu: "DJVU",
    cbz: "CBZ",
    cbr: "CBR",
    zip: "ZIP",
    rtf: "RTF",
  };
  return names[format] ?? format.toUpperCase();
}
