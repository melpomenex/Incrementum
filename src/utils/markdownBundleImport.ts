/**
 * Markdown Bundle Import Utilities
 *
 * Handles importing markdown "bundles" - directories or file sets containing
 * markdown files with associated images and metadata JSON files.
 *
 * Supports patterns like:
 * - my-notes/images/ + my-notes/Notes.md + my-notes/Notes_metadata.json
 * - Notes.md + Notes_metadata.json (flat bundle)
 */

import type { Document } from '../types/document';

/**
 * Metadata JSON schema from note-taking app exports (Obsidian, Notion, etc.)
 */
export interface MarkdownMetadata {
  title?: string;
  author?: string;
  tags?: string[];
  created?: string;
  modified?: string;
  source?: string;
  wordCount?: number;
  readingTime?: number;
  // Allow additional fields
  [key: string]: unknown;
}

/**
 * Represents a detected markdown bundle
 */
export interface MarkdownBundle {
  markdownFile: File;
  markdownContent: string;
  metadata?: MarkdownMetadata;
  metadataFile?: File;
  images: Map<string, File>; // relative path -> File
  imageDirectory?: string; // e.g., "images", "assets"
}

/**
 * Result of bundle detection
 */
export interface BundleDetectionResult {
  isBundle: boolean;
  bundle?: MarkdownBundle;
  singleMarkdownFiles?: File[]; // Files that are standalone markdown
}

/**
 * Detect if a set of files represents a markdown bundle
 *
 * Patterns detected:
 * 1. Directory with .md + images/ folder + optional _metadata.json
 * 2. Flat files: .md + _metadata.json with matching names
 * 3. Single .md with images subfolder
 */
export async function detectMarkdownBundle(files: File[]): Promise<BundleDetectionResult> {
  if (!files || files.length === 0) {
    return { isBundle: false };
  }

  // Find all markdown files
  const markdownFiles = files.filter(isMarkdownFile);

  if (markdownFiles.length === 0) {
    return { isBundle: false };
  }

  // If multiple markdown files with no images/metadata, treat as individual imports
  const imageFiles = files.filter(isImageFile);
  const metadataFiles = files.filter(isMetadataFile);

  if (markdownFiles.length > 1 && imageFiles.length === 0 && metadataFiles.length === 0) {
    return { isBundle: false, singleMarkdownFiles: markdownFiles };
  }

  // Try to find bundles for each markdown file
  const bundles: MarkdownBundle[] = [];

  for (const mdFile of markdownFiles) {
    const bundle = await tryCreateBundle(mdFile, files);
    if (bundle) {
      bundles.push(bundle);
    }
  }

  if (bundles.length === 1) {
    return { isBundle: true, bundle: bundles[0] };
  }

  if (bundles.length > 1) {
    // Multiple bundles detected - for now, just return the first one
    // In the future, we could return all bundles for batch import
    return { isBundle: true, bundle: bundles[0] };
  }

  // No bundle pattern found, treat as single files
  return { isBundle: false, singleMarkdownFiles: markdownFiles };
}

/**
 * Try to create a bundle from a markdown file and related files
 */
async function tryCreateBundle(mdFile: File, allFiles: File[]): Promise<MarkdownBundle | null> {
  const mdName = getBaseName(mdFile.name);
  const mdContent = await readFileAsText(mdFile);

  // Look for companion metadata file
  const metadataFile = allFiles.find(f =>
    isMetadataFile(f) && getBaseName(f.name) === mdName
  );

  let metadata: MarkdownMetadata | undefined;
  if (metadataFile) {
    metadata = await parseMetadataJson(metadataFile);
  }

  // Extract frontmatter from markdown as fallback metadata
  const frontmatterMetadata = extractMarkdownFrontMatter(mdContent);

  // Merge: JSON metadata takes precedence over frontmatter
  const mergedMetadata: MarkdownMetadata | undefined = metadata || frontmatterMetadata
    ? { ...frontmatterMetadata, ...metadata }
    : undefined;

  // Find related images
  const images = new Map<string, File>();
  let imageDirectory: string | undefined;

  // Look for images in common subfolders (images, assets, img)
  const imageDirs = ['images', 'assets', 'img', 'media', ''];
  const mdDir = getFileDirectory(mdFile);

  for (const file of allFiles) {
    if (!isImageFile(file)) continue;

    const filePath = getRelativePath(file);
    const fileDir = getFileDirectory(file);

    // Check if image is in a related directory
    const isRelated = imageDirs.some(dir => {
      if (dir === '') {
        // Images in same directory as markdown
        return fileDir === mdDir;
      }
      return filePath.includes(`/${dir}/`) || filePath.startsWith(`${dir}/`) || fileDir.includes(dir);
    });

    if (isRelated) {
      // Store with relative path from markdown's perspective
      const relativePath = extractImageRelativePath(file, mdDir);
      images.set(relativePath, file);

      if (!imageDirectory && relativePath.includes('/')) {
        imageDirectory = relativePath.split('/')[0];
      }
    }
  }

  // Also look for images referenced in markdown that might be in the file list
  const referencedImages = extractImageReferences(mdContent);
  for (const ref of referencedImages) {
    if (images.has(ref)) continue;

    // Try to find matching file
    const matchingFile = allFiles.find(f => {
      const path = getRelativePath(f);
      return path.endsWith(ref) || f.name === ref || path === ref;
    });

    if (matchingFile && isImageFile(matchingFile)) {
      images.set(ref, matchingFile);
    }
  }

  return {
    markdownFile: mdFile,
    markdownContent: mdContent,
    metadata: mergedMetadata,
    metadataFile,
    images,
    imageDirectory,
  };
}

/**
 * Parse a metadata JSON file
 */
export async function parseMetadataJson(file: File): Promise<MarkdownMetadata | undefined> {
  try {
    const content = await readFileAsText(file);
    const parsed = JSON.parse(content);
    return parsed as MarkdownMetadata;
  } catch (error) {
    console.warn('[markdownBundleImport] Failed to parse metadata JSON:', error);
    return undefined;
  }
}

/**
 * Extract YAML frontmatter from markdown content
 *
 * Supports:
 * ---
 * title: My Document
 * author: John Doe
 * tags: [tag1, tag2]
 * ---
 */
export function extractMarkdownFrontMatter(content: string): MarkdownMetadata | undefined {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!frontmatterMatch) {
    return undefined;
  }

  const frontmatter = frontmatterMatch[1];
  const metadata: MarkdownMetadata = {};

  // Simple YAML-like parsing for common fields
  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Handle arrays [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1);
      metadata[key] = value.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    }
    // Handle quoted strings
    else if ((value.startsWith('"') && value.endsWith('"')) ||
             (value.startsWith("'") && value.endsWith("'"))) {
      metadata[key] = value.slice(1, -1);
    }
    // Handle numbers
    else if (/^\d+$/.test(value)) {
      metadata[key] = parseInt(value, 10);
    }
    // Plain string
    else {
      metadata[key] = value;
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Extract image references from markdown content
 */
export function extractImageReferences(content: string): string[] {
  const references: string[] = [];

  // Match ![alt](path) pattern
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    const path = match[2];
    // Skip absolute URLs
    if (!path.startsWith('http://') && !path.startsWith('https://') && !path.startsWith('data:')) {
      references.push(path);
    }
  }

  return [...new Set(references)]; // Deduplicate
}

/**
 * Create a Document object from a markdown bundle
 */
export async function createBundleDocument(
  bundle: MarkdownBundle,
  docId: string,
  options?: {
    category?: string;
    collectionId?: string;
    priority?: number;
  }
): Promise<Omit<Document, 'id'>> {
  const now = new Date().toISOString();

  // Get title from metadata or filename
  const title = bundle.metadata?.title ||
                getBaseName(bundle.markdownFile.name);

  // Get tags from metadata
  const tags = bundle.metadata?.tags || [];

  // Calculate word count
  const wordCount = bundle.markdownContent.split(/\s+/).filter(w => w.length > 0).length;

  // Create image manifest
  const bundleImages: Record<string, string> = {};
  for (const [path, file] of bundle.images) {
    bundleImages[path] = file.name;
  }

  const doc: Omit<Document, 'id'> = {
    title,
    filePath: `bundle://${docId}/${bundle.markdownFile.name}`,
    fileType: 'markdown',
    content: bundle.markdownContent,
    contentHash: await generateHash(bundle.markdownContent),
    category: options?.category || 'Notes',
    tags,
    dateAdded: bundle.metadata?.created || now,
    dateModified: bundle.metadata?.modified || now,
    extractCount: 0,
    learningItemCount: 0,
    priorityRating: options?.priority ?? 5,
    prioritySlider: options?.priority ?? 50,
    priorityScore: options?.priority ?? 5,
    isArchived: false,
    isFavorite: false,
    metadata: {
      author: bundle.metadata?.author,
      source: bundle.metadata?.source || 'Markdown Import',
      wordCount: bundle.metadata?.wordCount || wordCount,
      readingTime: bundle.metadata?.readingTime || Math.ceil(wordCount / 250),
      collectionId: options?.collectionId,
      bundleImages,
      hasBundleImages: Object.keys(bundleImages).length > 0,
      originalFileName: bundle.markdownFile.name,
    },
  };

  return doc;
}

// Helper functions

function isMarkdownFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.md') || name.endsWith('.markdown');
}

function isImageFile(file: File): boolean {
  const imageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (imageTypes.includes(file.type)) return true;

  const name = file.name.toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].some(ext => name.endsWith(ext));
}

function isMetadataFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('_metadata.json') || name.endsWith('.metadata.json');
}

function getBaseName(filename: string): string {
  // Remove extension
  return filename.replace(/\.(md|markdown|json)$/i, '').replace(/_metadata$/i, '');
}

function getFileDirectory(file: File): string {
  // In browser, webkitRelativePath gives the path relative to dropped folder
  const path = (file as any).webkitRelativePath || '';
  const lastSlash = path.lastIndexOf('/');
  return lastSlash > 0 ? path.slice(0, lastSlash) : '';
}

function getRelativePath(file: File): string {
  return (file as any).webkitRelativePath || file.name;
}

function extractImageRelativePath(imageFile: File, mdDir: string): string {
  const path = getRelativePath(imageFile);

  // If markdown is in a subdirectory, make path relative to that
  if (mdDir && path.startsWith(mdDir + '/')) {
    return path.slice(mdDir.length + 1);
  }

  return path;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function generateHash(content: string): Promise<string> {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
