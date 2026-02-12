/**
 * Hook for importing markdown bundles
 *
 * Provides a complete flow for importing markdown bundles including:
 * - Converting images to embedded data URLs
 * - Creating the document with self-contained content
 * - Handling progress
 */

import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { MarkdownBundle } from "../utils/markdownBundleImport";
import { createBundleDocument } from "../utils/markdownBundleImport";
import {
  createDocument,
  getDocument,
  updateDocument,
  updateDocumentContent,
} from "../api/documents";
import type { Document } from "../types/document";
import type { ImportBundleOptions } from "../components/import/MarkdownBundlePreview";

interface UseMarkdownBundleImportResult {
  importBundle: (
    bundle: MarkdownBundle,
    options: ImportBundleOptions
  ) => Promise<Document>;
  progress: {
    current: number;
    total: number;
    status: string;
  } | null;
  error: string | null;
  isImporting: boolean;
}

export function useMarkdownBundleImport(): UseMarkdownBundleImportResult {
  const [progress, setProgress] = useState<{ current: number; total: number; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const importBundle = useCallback(
    async (bundle: MarkdownBundle, options: ImportBundleOptions): Promise<Document> => {
      setIsImporting(true);
      setError(null);
      const totalSteps = bundle.images.size + 2;
      setProgress({ current: 0, total: totalSteps, status: "Starting import..." });

      try {
        // Start with the original markdown content
        let markdownContent = bundle.markdownContent;

        // Convert images to embedded data URLs
        const imageEntries = Array.from(bundle.images.entries());
        for (let i = 0; i < imageEntries.length; i++) {
          const [path, file] = imageEntries[i];
          setProgress({
            current: i + 1,
            total: totalSteps,
            status: `Processing image ${i + 1} of ${imageEntries.length}...`,
          });

          // Read file as data URL
          const dataUrl = await readFileAsDataURL(file);

          // Replace all references to this image in the markdown
          // Match various path formats: images/foo.png, ./images/foo.png, foo.png, etc.
          const pathVariations = generatePathVariations(path);

          for (const pathVar of pathVariations) {
            // Escape special regex characters in the path
            const escapedPath = escapeRegExp(pathVar);
            // Match ![alt](path) pattern
            const imageRegex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedPath}\\)`, 'g');
            markdownContent = markdownContent.replace(imageRegex, `![$1](${dataUrl})`);
          }
        }

        setProgress({
          current: totalSteps - 1,
          total: totalSteps,
          status: "Creating document...",
        });

        // Create the document object with embedded images
        const docId = uuidv4();
        const docData = await createBundleDocument(bundle, docId, {
          category: options.category,
          priority: options.priority,
        });

        // Override content with image-embedded version
        const finalDoc = {
          ...docData,
          title: options.title,
          tags: options.tags,
          content: markdownContent,
          // Clear bundle image flags since images are now embedded
          metadata: {
            ...docData.metadata,
            bundleImages: {},
            hasBundleImages: false,
          },
        };

        // Create the document in the database
        setProgress({
          current: totalSteps,
          total: totalSteps,
          status: "Finalizing...",
        });

        const createdDocument = await createDocument(
          finalDoc.title,
          finalDoc.filePath,
          "markdown"
        );

        // Persist markdown body explicitly; backend update_document does not write `content`.
        await updateDocumentContent(createdDocument.id, markdownContent);

        // Persist the remaining editable fields that update_document supports.
        await updateDocument(createdDocument.id, {
          ...createdDocument,
          title: finalDoc.title,
          filePath: finalDoc.filePath,
          totalPages: finalDoc.totalPages,
          currentPage: finalDoc.currentPage,
          category: finalDoc.category,
          tags: finalDoc.tags,
          priorityRating: finalDoc.priorityRating,
          prioritySlider: finalDoc.prioritySlider,
          priorityScore: finalDoc.priorityScore,
          isArchived: finalDoc.isArchived,
          isFavorite: finalDoc.isFavorite,
          dateModified: finalDoc.dateModified,
        } as Document);

        const updatedDoc = await getDocument(createdDocument.id);
        if (!updatedDoc) {
          throw new Error("Imported markdown bundle document could not be loaded after save.");
        }

        setProgress(null);
        setIsImporting(false);

        return updatedDoc;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Import failed";
        setError(errorMsg);
        setProgress(null);
        setIsImporting(false);
        throw err;
      }
    },
    []
  );

  return {
    importBundle,
    progress,
    error,
    isImporting,
  };
}

// Helper to read file as data URL (base64 with mime type prefix)
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Generate variations of an image path to match different markdown reference styles
function generatePathVariations(path: string): string[] {
  const variations = new Set<string>();

  // Original path
  variations.add(path);

  // Without leading ./
  if (path.startsWith('./')) {
    variations.add(path.slice(2));
  }

  // With leading ./
  if (!path.startsWith('./') && !path.startsWith('../') && !path.startsWith('/')) {
    variations.add('./' + path);
  }

  // Just the filename
  const parts = path.split('/');
  if (parts.length > 1) {
    variations.add(parts[parts.length - 1]);
  }

  return Array.from(variations);
}

// Escape special regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
