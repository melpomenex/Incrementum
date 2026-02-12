/**
 * Image Path Resolver
 *
 * Handles rewriting relative image paths in markdown to bundle storage URLs.
 * Converts paths like `images/diagram.png` to `/api/documents/{docId}/images/diagram.png`
 */

/**
 * Resolve a relative image path to a bundle storage URL
 *
 * @param path - The original image path from markdown
 * @param docId - The document ID
 * @returns The resolved URL or original path if already absolute
 */
export function resolveRelativeImagePath(path: string, docId: string): string {
  // Skip if already absolute URL
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }

  // Skip if already a bundle URL
  if (path.startsWith('/api/documents/') || path.startsWith('blob:')) {
    return path;
  }

  // Clean up the path
  let cleanPath = path;

  // Remove leading ./ if present
  if (cleanPath.startsWith('./')) {
    cleanPath = cleanPath.slice(2);
  }

  // Remove leading ../ if present (go up one level - just use the filename)
  if (cleanPath.startsWith('../')) {
    const parts = cleanPath.split('/');
    // Use just the filename after all ../
    cleanPath = parts[parts.length - 1];
  }

  // URL-encode the path for special characters
  const encodedPath = encodeURI(cleanPath);

  // Return the bundle image URL
  return `/api/documents/${docId}/images/${encodedPath}`;
}

/**
 * Collect all images referenced in markdown content
 *
 * @param markdown - The markdown content
 * @returns Array of relative image paths
 */
export function collectImageReferences(markdown: string): string[] {
  const references: string[] = [];

  // Match ![alt](path) pattern
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = imageRegex.exec(markdown)) !== null) {
    const path = match[2];
    // Skip absolute URLs
    if (!path.startsWith('http://') && !path.startsWith('https://') && !path.startsWith('data:')) {
      references.push(path);
    }
  }

  // Also check HTML img tags
  const imgTagRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  while ((match = imgTagRegex.exec(markdown)) !== null) {
    const path = match[1];
    if (!path.startsWith('http://') && !path.startsWith('https://') && !path.startsWith('data:')) {
      references.push(path);
    }
  }

  return [...new Set(references)];
}

/**
 * Rewrite all image paths in markdown content to bundle URLs
 *
 * @param markdown - The original markdown content
 * @param docId - The document ID
 * @param imageManifest - Optional map of original paths to stored filenames
 * @returns Markdown with rewritten image paths
 */
export function rewriteImagePaths(
  markdown: string,
  docId: string,
  imageManifest?: Record<string, string>
): string {
  let result = markdown;

  // Get all image references
  const references = collectImageReferences(markdown);

  // Rewrite each reference
  for (const originalPath of references) {
    // Check if we have a manifest mapping
    const storedName = imageManifest?.[originalPath];
    const pathToUse = storedName || originalPath;

    const resolvedUrl = resolveRelativeImagePath(pathToUse, docId);

    // Replace in markdown image syntax ![alt](path)
    const mdImageRegex = new RegExp(
      `!\\[([^\\]]*)\\]\\(${escapeRegExp(originalPath)}\\)`,
      'g'
    );
    result = result.replace(mdImageRegex, `![$1](${resolvedUrl})`);

    // Replace in HTML img tags
    const htmlImgRegex = new RegExp(
      `(<img[^>]+src=["'])${escapeRegExp(originalPath)}(["'])`,
      'gi'
    );
    result = result.replace(htmlImgRegex, `$1${resolvedUrl}$2`);
  }

  return result;
}

/**
 * Extract the filename from an image path
 */
export function getImageFilename(path: string): string {
  // Handle various path formats
  const cleanPath = path.replace(/^\.?\//, '').replace(/\.\.\//g, '');
  const parts = cleanPath.split('/');
  return parts[parts.length - 1];
}

/**
 * Check if a path looks like a relative image path
 */
export function isRelativeImagePath(path: string): boolean {
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return false;
  }
  if (path.startsWith('/api/') || path.startsWith('blob:')) {
    return false;
  }

  // Check for common image extensions
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
  return imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
}

/**
 * Create an image manifest from files
 *
 * @param files - Map of relative path to File objects
 * @returns Manifest mapping paths to filenames
 */
export function createImageManifest(files: Map<string, File>): Record<string, string> {
  const manifest: Record<string, string> = {};

  for (const [path, file] of files) {
    manifest[path] = file.name;
    // Also store with just filename as key for easier lookup
    manifest[file.name] = file.name;
  }

  return manifest;
}

// Helper to escape regex special characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
