/**
 * Kindle Clippings Import Utility
 *
 * Handles importing `My Clippings.txt` files from Kindle e-readers
 * into Incrementum Documents + Extracts with content-hash deduplication.
 */

import { invokeCommand, openFilePicker } from "../lib/tauri";

export interface KindleBookGroup {
  title: string;
  author: string | null;
  normalizedTitle: string;
  highlightsCount: number;
  notesCount: number;
  bookmarksCount: number;
}

export interface KindleValidationResult {
  books: KindleBookGroup[];
  totalClippings: number;
  totalHighlights: number;
  totalNotes: number;
  totalBookmarks: number;
  warnings: string[];
}

export interface KindleBookPreview {
  title: string;
  author: string | null;
  newHighlights: number;
  existingHighlights: number;
  newNotes: number;
  existingNotes: number;
  skippedBookmarks: number;
  isNewBook: boolean;
}

export interface KindlePreviewResult {
  books: KindleBookPreview[];
  totalNewExtracts: number;
  totalExistingExtracts: number;
  warnings: string[];
}

export interface KindleImportResult {
  newDocuments: number;
  newExtracts: number;
  updatedDocuments: number;
  warnings: string[];
}

/**
 * Parse a Kindle clippings file (format check, no DB involved).
 */
export async function parseKindleClippings(filePath: string): Promise<KindleValidationResult> {
  return invokeCommand<KindleValidationResult>("parse_kindle_clippings_file", {
    filePath,
  });
}

/**
 * Validate a Kindle clippings file against the existing database (dedup check).
 */
export async function validateKindleClippings(filePath: string): Promise<KindlePreviewResult> {
  return invokeCommand<KindlePreviewResult>("validate_kindle_clippings", {
    filePath,
  });
}

/**
 * Import a Kindle clippings file into the database.
 */
export async function importKindleClippings(filePath: string, collectionId?: string): Promise<KindleImportResult> {
  return invokeCommand<KindleImportResult>("import_kindle_clippings_file", {
    filePath,
    collectionId: collectionId ?? null,
  });
}

/**
 * Open a file picker filtered to .txt files for Kindle clippings.
 */
export async function selectKindleClippingsFile(): Promise<string | null> {
  const files = await openFilePicker({
    multiple: false,
    filters: [
      {
        name: "Kindle Clippings",
        extensions: ["txt"],
      },
    ],
  });
  if (!files || files.length === 0) return null;
  return files[0];
}
