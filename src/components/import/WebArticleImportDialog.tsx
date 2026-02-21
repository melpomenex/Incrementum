/**
 * Web Article Import Dialog
 * 
 * Import web articles by URL with a rich preview that preserves the original page styling.
 * Uses CORS proxies for browser mode and integrates with the FSRS scheduling system.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Globe,
  Link2,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ExternalLink,
  BookOpen,
  Sparkles,
  Eye,
  Code,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { cn } from "../../utils";
import { useDocumentStore } from "../../stores/documentStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useToast } from "../common/Toast";
import type { Document } from "../../types/document";
import { isTauri } from "../../lib/tauri";

interface WebArticleImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDocument?: (doc: Document) => void;
}

interface ArticlePreview {
  url: string;
  title: string;
  author?: string;
  description?: string;
  text: string;
  html?: string;
  processedHtml?: string;
  wordCount: number;
  readingTime: number;
  siteName?: string;
  image?: string;
  favicon?: string;
  fetchMethod?: 'direct' | 'proxy';
}

export function WebArticleImportDialog({ isOpen, onClose, onOpenDocument }: WebArticleImportDialogProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [preview, setPreview] = useState<ArticlePreview | null>(null);
  const [tags, setTags] = useState<string[]>(["article", "web"]);
  const [newTag, setNewTag] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const [, setImportedDoc] = useState<Document | null>(null);
  const [previewMode, setPreviewMode] = useState<'rendered' | 'text'>('rendered');
  const [showCorsWarning, setShowCorsWarning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { importFromUrl, loadDocuments } = useDocumentStore();
  const { success: showSuccess, error: showError } = useToast();

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setUrl("");
      setPreview(null);
      setError(null);
      setErrorDetails(null);
      setTags(["article", "web"]);
      setNewTag("");
      setImportSuccess(false);
      setShowCorsWarning(false);
      setPreviewMode('rendered');
    }
  }, [isOpen]);

  const extractSiteName = (url: string): string => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  };

  const calculateReadingTime = (wordCount: number): number => {
    const wordsPerMinute = 250;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  /**
   * Fetch article content with CORS proxy fallback for browser mode
   */
  const fetchArticleContent = async (targetUrl: string): Promise<{
    html: string;
    title: string;
    text: string;
    fetchMethod: 'direct' | 'proxy';
  }> => {
    const corsProxies = [
      null, // Try direct first
      'https://api.allorigins.win/raw?url=',
      'https://corsproxy.io/?',
      'https://api.codetabs.com/v1/proxy?quest='
    ];

    let lastError: Error | null = null;

    // Try direct fetch first (works in Tauri, or for CORS-enabled sites)
    for (const proxy of corsProxies) {
      try {
        const fetchUrl = proxy ? proxy + encodeURIComponent(targetUrl) : targetUrl;
        console.log(`[WebArticleImport] Trying fetch:`, proxy || 'direct');
        
        const response = await fetch(fetchUrl, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        
        if (html.length < 100) {
          throw new Error('Response too short, likely an error page');
        }

        // Parse the HTML to extract title and text
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract title
        const title = doc.querySelector('title')?.textContent?.trim() || 
                      doc.querySelector('h1')?.textContent?.trim() || 
                      extractSiteName(targetUrl);

        // Extract text content
        const text = doc.body?.textContent?.trim() || '';

        console.log(`[WebArticleImport] Successfully fetched via ${proxy || 'direct'}`);
        
        return {
          html,
          title,
          text,
          fetchMethod: proxy ? 'proxy' : 'direct',
        };
      } catch (err) {
        console.log(`[WebArticleImport] Fetch failed:`, proxy || 'direct', err);
        lastError = err as Error;
        continue;
      }
    }

    throw new Error(`Failed to fetch article. ${lastError?.message || 'All fetch methods failed.'}`);
  };

  const { settings } = useSettingsStore();

  /**
   * Process HTML for display - preserves styling but sanitizes dangerous content
   */
  const processHtmlForDisplay = (
    rawHtml: string,
    baseUrl: string,
    preserveImages: boolean
  ): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    
    // Remove dangerous elements
    const dangerousSelectors = [
      'script',
      'iframe',
      'object',
      'embed',
      'form',
      'input[type="password"]',
      'input[type="submit"]',
      'button[type="submit"]',
    ];
    
    dangerousSelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => {
        console.log(`[WebArticleImport] Removing dangerous element:`, el.tagName);
        el.remove();
      });
    });

    if (!preserveImages) {
      const imageSelectors = ['img', 'picture', 'source'];
      imageSelectors.forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => {
          el.remove();
        });
      });
    }

    // Remove event handlers from all elements
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      const attributes = Array.from(el.attributes);
      attributes.forEach(attr => {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      });
    });

    // Add base tag for relative URLs
    let baseTag = doc.querySelector('base');
    if (!baseTag) {
      baseTag = doc.createElement('base');
      baseTag.href = new URL(baseUrl).origin + '/';
      doc.head.insertBefore(baseTag, doc.head.firstChild);
    }

    // Add custom styles for better preview
    const styleTag = doc.createElement('style');
    styleTag.textContent = `
      /* Reset for consistent preview */
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        overflow-x: hidden !important;
      }
      
      /* Ensure images don't overflow */
      img {
        max-width: 100% !important;
        height: auto !important;
      }
      
      /* Improve readability */
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
      }
      
      /* Hide potentially distracting elements */
      nav[role="navigation"],
      .navigation,
      .nav,
      header[role="banner"],
      .site-header,
      footer[role="contentinfo"],
      .site-footer,
      .comments,
      #comments,
      .social-share,
      .share-buttons,
      .advertisement,
      .ads,
      #disqus_thread {
        display: none !important;
      }
    `;
    doc.head.appendChild(styleTag);

    return doc.documentElement.outerHTML;
  };

  const handleFetch = useCallback(async () => {
    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    // Basic URL validation
    let processedUrl = url.trim();
    if (!processedUrl.startsWith("http://") && !processedUrl.startsWith("https://")) {
      processedUrl = `https://${processedUrl}`;
      setUrl(processedUrl);
    }

    setIsLoading(true);
    setError(null);
    setErrorDetails(null);
    setPreview(null);
    setShowCorsWarning(false);

    try {
      // Validate URL format
      new URL(processedUrl);

      // Fetch article content
      const { html, title, text, fetchMethod } = await fetchArticleContent(processedUrl);
      
      // Process HTML for display
      const processedHtml = processHtmlForDisplay(
        html,
        processedUrl,
        settings.documents.webImportPreserveImages
      );
      
      // Calculate metadata
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      
      // Extract author if available
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const author = 
        doc.querySelector('meta[name="author"]')?.getAttribute('content') ||
        doc.querySelector('meta[property="article:author"]')?.getAttribute('content') ||
        doc.querySelector('[rel="author"]')?.textContent ||
        undefined;

      // Extract description
      const description = 
        doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
        doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
        undefined;

      // Extract favicon
      const favicon = 
        doc.querySelector('link[rel="icon"]')?.getAttribute('href') ||
        doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
        `${new URL(processedUrl).origin}/favicon.ico`;

      // Extract main image
      const image = 
        doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
        doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
        undefined;

      setPreview({
        url: processedUrl,
        title,
        author,
        description,
        text,
        html,
        processedHtml,
        wordCount,
        readingTime: calculateReadingTime(wordCount),
        siteName: extractSiteName(processedUrl),
        image,
        favicon,
        fetchMethod,
      });

      // Show CORS warning if we had to use a proxy
      if (fetchMethod === 'proxy' && !isTauri()) {
        setShowCorsWarning(true);
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch article";
      setError(message);
      
      // Provide helpful error details based on error type
      if (message.includes('CORS') || message.includes('Failed to fetch')) {
        setErrorDetails(
          isTauri() 
            ? "The website may be blocking automated requests. Try a different URL."
            : "Browser security (CORS) is preventing direct access. The app tried multiple proxy servers but couldn't retrieve the content. Try using the desktop app for better compatibility."
        );
      } else if (message.includes('404')) {
        setErrorDetails("The page was not found. Please check the URL and try again.");
      } else if (message.includes('403')) {
        setErrorDetails("Access to this page is forbidden. The site may require authentication.");
      }
      
      showError("Fetch failed", message);
    } finally {
      setIsLoading(false);
    }
  }, [url, showError]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFetch();
    }
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleImport = async () => {
    if (!preview) return;

    setIsImporting(true);
    setError(null);

    try {
      // Import the document using the store
      const doc = await importFromUrl(preview.url);
      
      setImportedDoc(doc);

      // Update the document with user-selected tags and additional metadata
      const { updateDocument } = useDocumentStore.getState();
      
      await updateDocument(doc.id, { 
        tags,
        title: preview.title || doc.title,
        content: preview.processedHtml || preview.text,
        metadata: {
          ...doc.metadata,
          author: preview.author,
          subject: preview.description,
          source: preview.url,
          siteName: preview.siteName,
          image: preview.image,
          favicon: preview.favicon,
          fetchMethod: preview.fetchMethod,
          wordCount: preview.wordCount,
          readingTime: preview.readingTime,
        }
      });
      
      // Reload to get latest state
      await loadDocuments();

      setImportSuccess(true);
      showSuccess("Article imported", `"${preview.title.substring(0, 50)}..." has been added to your library`);

      // Close dialog and open the document
      setTimeout(() => {
        onClose();
        if (onOpenDocument && doc) {
          onOpenDocument(doc);
        }
      }, 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      setError(message);
      showError("Import failed", message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Globe className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Import Web Article</h2>
              <p className="text-sm text-muted-foreground">
                Save articles from the web to your library
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel - URL input and options */}
          <div className="flex w-96 flex-col border-r border-border bg-card/50">
            <div className="flex-1 overflow-y-auto p-5">
              {/* URL Input */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Article URL
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="https://example.com/article"
                      className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <button
                    onClick={handleFetch}
                    disabled={isLoading || !url.trim()}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Fetch
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Enter a URL to fetch the article content. Supports most websites.
                </p>
              </div>

              {/* CORS Warning */}
              {showCorsWarning && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>CORS Proxy Used</strong>
                      <p className="mt-0.5">
                        This page was fetched through a CORS proxy. Some resources like images may not load properly.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-primary/70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Add tag..."
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!newTag.trim()}
                    className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Quick tags */}
              <div className="mb-6">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Quick Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {["article", "blog", "tutorial", "research", "news", "video"].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        if (!tags.includes(tag)) {
                          setTags([...tags, tag]);
                        }
                      }}
                      disabled={tags.includes(tag)}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-destructive font-medium">{error}</p>
                      {errorDetails && (
                        <p className="text-xs text-destructive/80 mt-1">{errorDetails}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleFetch}
                    className="mt-2 flex items-center gap-1 text-xs text-destructive hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Try Again
                  </button>
                </div>
              )}
            </div>

            {/* Import button */}
            {preview && (
              <div className="border-t border-border p-5">
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className={cn(
                    "w-full rounded-lg py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2",
                    importSuccess
                      ? "bg-green-500 text-white"
                      : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  )}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : importSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Imported Successfully
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-4 w-4" />
                      Import to Library
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right panel - Preview */}
          <div className="flex flex-1 flex-col overflow-hidden bg-background">
            {isLoading ? (
              <div className="flex h-full flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Fetching article...</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Trying direct fetch, then CORS proxies if needed
                </p>
              </div>
            ) : !preview ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 rounded-full bg-muted p-4">
                  <Globe className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-foreground">
                  Import Web Articles
                </h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Enter a URL to fetch article content. The page will be saved to your library for reading and extracting.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-2 py-1">Medium</span>
                  <span className="rounded bg-muted px-2 py-1">Substack</span>
                  <span className="rounded bg-muted px-2 py-1">Wikipedia</span>
                  <span className="rounded bg-muted px-2 py-1">+ more</span>
                </div>
                {!isTauri() && (
                  <div className="mt-4 text-xs text-amber-600 dark:text-amber-400 max-w-sm">
                    <strong>Note:</strong> In browser mode, some websites may not be accessible due to CORS restrictions. 
                    For best results, use the desktop app.
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Preview header */}
                <div className="border-b border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="mb-1 text-xl font-semibold text-foreground">
                        {preview.title}
                      </h3>
                      {preview.author && (
                        <p className="mb-2 text-sm text-muted-foreground">
                          By {preview.author}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {preview.siteName}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {preview.wordCount.toLocaleString()} words
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {preview.readingTime} min read
                        </span>
                        {preview.fetchMethod === 'proxy' && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <ShieldAlert className="h-3 w-3" />
                              Via Proxy
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <a
                      href={preview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Open original"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  {preview.description && (
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
                      {preview.description}
                    </p>
                  )}

                  {/* Tags preview */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Preview mode toggle */}
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Preview mode:</span>
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                      <button
                        onClick={() => setPreviewMode('rendered')}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                          previewMode === 'rendered' 
                            ? "bg-background text-foreground shadow-sm" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Eye className="h-3 w-3" />
                        Rendered
                      </button>
                      <button
                        onClick={() => setPreviewMode('text')}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                          previewMode === 'text' 
                            ? "bg-background text-foreground shadow-sm" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Code className="h-3 w-3" />
                        Text
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content preview */}
                <div className="flex-1 overflow-hidden bg-background">
                  {previewMode === 'rendered' && preview.processedHtml ? (
                    <iframe
                      ref={iframeRef}
                      srcDoc={preview.processedHtml}
                      className="w-full h-full border-0"
                      sandbox="allow-same-origin allow-scripts"
                      title="Article Preview"
                    />
                  ) : (
                    <div className="h-full overflow-y-auto p-5">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {preview.text ? (
                          <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {preview.text.substring(0, 5000)}
                            {preview.text.length > 5000 && (
                              <span className="text-muted-foreground/50">
                                {"\n\n"}... (content truncated in preview)
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-muted-foreground italic">
                            No text content available for preview.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
