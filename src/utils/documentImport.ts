/**
 * Document Import Utilities
 * Handles importing documents from various sources: URLs, Arxiv, files, etc.
 */

import { Document } from '../types/document';
import { fetchUrlContent, readDocumentFile } from '../api/documents';
import { isTauri } from '../lib/tauri';

/**
 * CORS proxies for browser mode
 */
const CORS_PROXIES = [
  null, // Try direct first
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest='
];

/**
 * Fetch article content with CORS proxy fallback
 */
async function fetchArticleWithProxy(url: string): Promise<{
  html: string;
  title: string;
  fetchMethod: 'direct' | 'proxy';
}> {
  let lastError: Error | null = null;

  for (const proxy of CORS_PROXIES) {
    try {
      const fetchUrl = proxy ? proxy + encodeURIComponent(url) : url;
      
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

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const title = doc.querySelector('title')?.textContent?.trim() || 
                    doc.querySelector('h1')?.textContent?.trim() || 
                    new URL(url).hostname;

      return {
        html,
        title,
        fetchMethod: proxy ? 'proxy' : 'direct',
      };
    } catch (err) {
      console.error(`[importFromUrl] Fetch failed:`, proxy || 'direct', err);
      lastError = err as Error;
      continue;
    }
  }

  throw new Error(`Failed to fetch URL after trying all methods. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Process HTML content for safe display
 */
export function processHtmlContent(rawHtml: string, baseUrl: string, title: string, preserveImages: boolean): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');
  let baseHref = baseUrl;
  try {
    // If the URL is an arXiv HTML page, ensure it has a trailing slash so that path-relative assets
    // resolve correctly under the paper ID directory (e.g. /html/2403.12345/image.png)
    if (baseUrl.includes('arxiv.org/html/')) {
      const urlObj = new URL(baseUrl);
      if (!urlObj.pathname.endsWith('/')) {
        urlObj.pathname += '/';
      }
      baseHref = urlObj.toString();
    } else {
      baseHref = new URL(baseUrl).origin + '/';
    }
  } catch {
    if (baseUrl.startsWith('file://')) {
      baseHref = baseUrl;
    } else if (baseUrl.startsWith('/')) {
      baseHref = `file://${baseUrl}`;
    } else {
      baseHref = window.location.origin + '/';
    }
  }
  
  const dangerousSelectors = [
    'script',
    'iframe',
    'object',
    'embed',
    'form',
    'input[type="password"]',
  ];
  
  dangerousSelectors.forEach(selector => {
    doc.querySelectorAll(selector).forEach(el => el.remove());
  });

  if (!preserveImages) {
    const imageSelectors = ['img', 'picture', 'source'];
    imageSelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    });
  }

  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  // Add base tag
  let baseTag = doc.querySelector('base');
  if (!baseTag) {
    baseTag = doc.createElement('base');
    baseTag.href = baseHref;
    doc.head.insertBefore(baseTag, doc.head.firstChild);
  }

  // Add guardrails for sizing (inline styles stripped above; viewer CSS handles theming).
  const styleTag = doc.createElement('style');
  styleTag.textContent = `
    html, body {
      overflow-x: hidden !important;
    }

    img {
      max-width: 100% !important;
      height: auto !important;
    }
  `;
  doc.head.appendChild(styleTag);

  // Ensure title exists for display contexts
  if (!doc.querySelector('title')) {
    const titleTag = doc.createElement('title');
    titleTag.textContent = title;
    doc.head.appendChild(titleTag);
  }

  return doc.documentElement.outerHTML;
}

/**
 * Fetch content from a URL and create a document
 */
export async function importFromUrl(
  url: string,
  options?: { preserveImages?: boolean }
): Promise<Omit<Document, 'id'>> {
  try {
    const validUrl = new URL(url);
    const hostname = validUrl.hostname;
    const preserveImages = options?.preserveImages ?? true;

    let title: string;
    let content: string;
    let filePath: string;
    let fileType: Document['fileType'] = 'html';
    let fetchMethod: 'direct' | 'proxy' = 'direct';

    const isDirectFile = /\.(pdf|epub|md|markdown|txt|html?)$/i.test(validUrl.pathname);

    if (isDirectFile) {
      // For direct files, use the backend fetch
      const fetched = await fetchUrlContent(validUrl.toString());
      filePath = fetched.file_path;
      
      if (fetched.content_type.includes('pdf')) {
        fileType = 'pdf';
      } else if (fetched.content_type.includes('markdown') || fetched.content_type.includes('text/markdown')) {
        fileType = 'markdown';
      } else if (url.match(/\.(md|markdown)$/i)) {
        fileType = 'markdown';
      } else if (url.match(/\.(txt)$/i)) {
        fileType = 'other';
      }

      const urlParts = validUrl.pathname.split('/');
      const fileName = urlParts[urlParts.length - 1] || hostname;
      title = fileName.replace(/\.(html?|md|txt|pdf|epub)$/i, '') || `Web Content - ${hostname}`;

      // For HTML files, process the content
      if (fileType === 'html') {
        try {
          const base64Content = await readDocumentFile(fetched.file_path);
          const htmlContent = atob(base64Content);
          content = processHtmlContent(htmlContent, url, title, preserveImages);
        } catch (error) {
          console.warn('Failed to process HTML content:', error);
          content = `<div style="font-family: sans-serif; padding: 20px;">
            <h2>Imported from ${hostname}</h2>
            <p>Content will be available once you open this document.</p>
            <p><a href="${url}" target="_blank">View original page →</a></p>
          </div>`;
        }
      } else {
        content = `Imported from ${url}`;
      }
    } else {
      // For web pages, fetch content. In Tauri (desktop) mode we MUST go
      // through the backend's fetch_url_content command — reqwest is not
      // subject to CORS, whereas a webview `fetch()` on a cross-origin URL
      // is blocked by CORS and WebKit reports it as a cryptic "Load failed".
      // The browser fetch + CORS-proxy fallback below is only useful in
      // actual browser/PWA mode where there is no Rust backend to lean on.
      if (isTauri()) {
        fetchMethod = 'direct';
        const fetched = await fetchUrlContent(validUrl.toString());
        filePath = fetched.file_path;

        // Read the downloaded HTML back and parse it. readDocumentFile
        // returns base64-encoded content.
        let html: string;
        try {
          const base64Content = await readDocumentFile(fetched.file_path);
          html = atob(base64Content);
        } catch (error) {
          console.warn('Failed to read fetched HTML content:', error);
          html = `<html><head><title>${hostname}</title></head><body>
            <h2>Imported from ${hostname}</h2>
            <p>Content will be available once you open this document.</p>
            <p><a href="${url}" target="_blank">View original page →</a></p>
          </body></html>`;
        }

        const parser = new DOMParser();
        const parsed = parser.parseFromString(html, 'text/html');
        title =
          parsed.querySelector('title')?.textContent?.trim() ||
          parsed.querySelector('h1')?.textContent?.trim() ||
          hostname;
        content = processHtmlContent(html, url, title, preserveImages);
      } else {
        // Browser/PWA mode - no Rust backend, so use browser fetch with
        // CORS-proxy fallback.
        const { html, title: fetchedTitle, fetchMethod: method } = await fetchArticleWithProxy(url);
        fetchMethod = method;
        title = fetchedTitle;

        content = processHtmlContent(html, url, title, preserveImages);

        // Browser mode - use a virtual path
        filePath = `browser-fetched://article-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const text = doc.body?.textContent?.trim() || '';
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    const author = 
      doc.querySelector('meta[name="author"]')?.getAttribute('content') ||
      doc.querySelector('meta[property="article:author"]')?.getAttribute('content') ||
      undefined;

    const description = 
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      undefined;

    const image = 
      doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
      undefined;

    const now = new Date().toISOString();
    const newDoc: Omit<Document, 'id'> = {
      title: title || `Web Content - ${hostname}`,
      filePath: filePath,
      fileType: fileType,
      content: content,
      contentHash: await generateHash(url + now),
      category: 'Web Import',
      tags: ['web-import', hostname.replace(/^www\./, '')],
      dateAdded: now,
      dateModified: now,
      extractCount: 0,
      learningItemCount: 0,
      priorityRating: 0,
      prioritySlider: 50, // Default to normal priority
      priorityScore: 5,   // Default priority score
      isArchived: false,
      isFavorite: false,
      // FSRS scheduling fields - new items start fresh
      nextReadingDate: undefined, // Will be set when first reviewed
      stability: 0,
      difficulty: 0,
      reps: 0,
      totalTimeSpent: 0,
      metadata: {
        source: url,
        fetchedAt: now,
        language: 'en',
        author,
        subject: description,
        siteName: hostname.replace(/^www\./, ''),
        image,
        fetchMethod,
        wordCount,
        readingTime: Math.ceil(wordCount / 250),
      },
    };

    return newDoc;
  } catch (error) {
    throw new Error(`Failed to import from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Import paper from Arxiv
 */
export async function importFromArxiv(input: string, format: 'pdf' | 'html' = 'pdf'): Promise<Omit<Document, 'id'>> {
  try {
    const arxivId = extractArxivId(input);
    if (!arxivId) {
      throw new Error('Invalid Arxiv ID or URL');
    }

    const metadata = await fetchArxivMetadata(arxivId);

    // Download PDF or HTML using the backend fetch function
    const isHtml = format === 'html';
    const downloadUrl = isHtml
      ? `https://arxiv.org/html/${arxivId}`
      : `https://arxiv.org/pdf/${arxivId}.pdf`;
    const fetched = await fetchUrlContent(downloadUrl);
    const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

    let content = metadata.abstract;
    if (isHtml) {
      try {
        const base64Content = await readDocumentFile(fetched.file_path);
        const htmlContent = atob(base64Content);
        content = processHtmlContent(htmlContent, downloadUrl, metadata.title, true);
      } catch (error) {
        console.warn('Failed to process ArXiv HTML content:', error);
      }
    }

    const document: Omit<Document, 'id'> = {
      title: metadata.title,
      filePath: fetched.file_path,
      fileType: isHtml ? 'html' : 'pdf',
      content: content,
      contentHash: await generateHash(fetched.file_path),
      category: 'Research Papers',
      tags: [
        'arxiv',
        'research',
        ...metadata.categories.slice(0, 3),
      ],
      dateAdded: new Date().toISOString(),
      dateModified: new Date().toISOString(),
      extractCount: 0,
      learningItemCount: 0,
      priorityRating: 0,
      prioritySlider: 0,
      priorityScore: 7, // Research papers are high priority
      isArchived: false,
      isFavorite: false,
      metadata: {
        author: metadata.authors.join(', '),
        subject: metadata.primary_category,
        keywords: metadata.categories,
        createdAt: metadata.published,
        pageCount: undefined, // Will be determined when PDF is processed
        language: 'en',
        arxivId: arxivId,
        arxivUrl: `https://arxiv.org/abs/${arxivId}`,
        pdfUrl: pdfUrl,
        htmlUrl: isHtml ? downloadUrl : undefined,
        originalFileName: fetched.file_name,
      },
    };

    return document;
  } catch (error) {
    throw new Error(`Failed to import from Arxiv: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract Arxiv ID from various input formats
 */
function extractArxivId(input: string): string | null {
  // Remove whitespace and strip version suffix if present (e.g., v1, v2)
  const cleaned = input.trim().replace(/v\d+$/, '');

  // Direct ID format: 2301.07041 or cs.AI/1234567
  const directIdMatch = cleaned.match(/^(\d{4}\.\d+|[a-z-]+\/\d+)$/);
  if (directIdMatch) {
    return directIdMatch[1];
  }

  // URL format: https://arxiv.org/abs/2301.07041 or https://arxiv.org/pdf/2301.07041.pdf
  // Also handles version suffix in URLs like 2301.07041v1
  const urlMatch = cleaned.match(/arxiv\.org\/(abs|pdf)\/(\d{4}\.\d+(?:v\d+)?|[a-z-]+\/\d+(?:v\d+)?)/);
  if (urlMatch) {
    // Strip version suffix from extracted ID
    return urlMatch[2].replace(/v\d+$/, '');
  }

  return null;
}

/**
 * Fetch metadata from Arxiv API
 */
interface ArxivMetadata {
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  primary_category: string;
  published: string;
  updated: string;
}

async function fetchArxivMetadata(arxivId: string): Promise<ArxivMetadata> {
  const apiUrl = `https://export.arxiv.org/api/query?id_list=${arxivId}`;

  try {
    // Use backend fetchUrlContent to handle CORS via proxies
    const fetched = await fetchUrlContent(apiUrl);
    const base64Content = await readDocumentFile(fetched.file_path);
    const text = atob(base64Content);

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');

    const entry = xmlDoc.querySelector('entry');
    if (!entry) {
      throw new Error('Paper not found on Arxiv');
    }

    const title = entry.querySelector('title')?.textContent?.trim() || 'Unknown Title';
    const summary = entry.querySelector('summary')?.textContent?.trim() || '';
    const published = entry.querySelector('published')?.textContent || new Date().toISOString();
    const updated = entry.querySelector('updated')?.textContent || new Date().toISOString();

    const authors: string[] = [];
    entry.querySelectorAll('author name').forEach((author) => {
      authors.push(author.textContent || '');
    });

    const categories: string[] = [];
    const primaryCategory = entry.querySelector('primary_category')?.textContent || '';
    entry.querySelectorAll('category').forEach((cat) => {
      const term = cat.getAttribute('term');
      if (term) categories.push(term);
    });

    return {
      title,
      authors,
      abstract: summary,
      categories: [...new Set(categories)], // Deduplicate
      primary_category: primaryCategory,
      published,
      updated,
    };
  } catch (error) {
    console.error('Error fetching Arxiv metadata:', error);
    return {
      title: `Arxiv Paper ${arxivId}`,
      authors: [],
      abstract: '',
      categories: [],
      primary_category: 'unknown',
      published: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
  }
}

/**
 * Generate hash for content
 */
async function generateHash(content: string): Promise<string> {
  // Simple hash function for now
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Import from screenshot
 */
export async function importFromScreenshot(imageData: ArrayBuffer): Promise<Omit<Document, 'id'>> {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(imageData)));
  const hash = await generateHash(base64);

  const document: Omit<Document, 'id'> = {
    title: `Screenshot ${new Date().toLocaleString()}`,
    filePath: `screenshot://${hash}`,
    fileType: 'other',
    content: `Screenshot captured at ${new Date().toISOString()}`,
    contentHash: hash,
    category: 'Screenshots',
    tags: ['screenshot'],
    dateAdded: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    extractCount: 0,
    learningItemCount: 0,
    priorityRating: 0,
    prioritySlider: 0,
    priorityScore: 3,
    isArchived: false,
    isFavorite: false,
    metadata: {
      fileSize: imageData.byteLength,
      createdAt: new Date().toISOString(),
    },
  };

  return document;
}

/**
 * Validate URL before import
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are supported' };
    }

    const excludedDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (excludedDomains.includes(parsed.hostname)) {
      return { valid: false, error: 'Local URLs are not supported' };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid URL format',
    };
  }
}

/**
 * Validate Arxiv ID or URL
 */
export function validateArxivInput(input: string): { valid: boolean; error?: string } {
  const arxivId = extractArxivId(input);

  if (!arxivId) {
    return {
      valid: false,
      error: 'Invalid Arxiv ID or URL. Expected format: 2301.07041, 2301.07041v1, or https://arxiv.org/abs/2301.07041',
    };
  }

  return { valid: true };
}
