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
      console.log(`[importFromUrl] Trying fetch:`, proxy || 'direct');
      
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

      // Parse to extract title
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const title = doc.querySelector('title')?.textContent?.trim() || 
                    doc.querySelector('h1')?.textContent?.trim() || 
                    new URL(url).hostname;

      console.log(`[importFromUrl] Successfully fetched via ${proxy || 'direct'}`);
      
      return {
        html,
        title,
        fetchMethod: proxy ? 'proxy' : 'direct',
      };
    } catch (err) {
      console.log(`[importFromUrl] Fetch failed:`, proxy || 'direct', err);
      lastError = err as Error;
      continue;
    }
  }

  throw new Error(`Failed to fetch URL after trying all methods. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Process HTML content for safe display
 */
function processHtmlContent(rawHtml: string, baseUrl: string, title: string): string {
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
  ];
  
  dangerousSelectors.forEach(selector => {
    doc.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Remove event handlers
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
    baseTag.href = new URL(baseUrl).origin + '/';
    doc.head.insertBefore(baseTag, doc.head.firstChild);
  }

  // Try to extract main content
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '#content',
    '#main',
    '.post-content',
    '.entry-content',
    '.article-content'
  ];

  let mainElement = null;
  for (const selector of contentSelectors) {
    mainElement = doc.querySelector(selector);
    if (mainElement) break;
  }

  const contentHtml = mainElement ? mainElement.innerHTML : doc.body.innerHTML;

  // Create clean document
  const cleanDoc = document.implementation.createHTMLDocument(title);
  cleanDoc.head.innerHTML = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base href="${new URL(baseUrl).origin}/">
    <title>${title}</title>
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        line-height: 1.6; 
        max-width: 800px; 
        margin: 0 auto; 
        padding: 20px; 
        color: #333;
      }
      img { max-width: 100%; height: auto; }
      pre { background: #f4f4f4; padding: 1em; overflow-x: auto; border-radius: 4px; }
      code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
      blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1em; color: #666; }
      h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
      p { margin-bottom: 1em; }
      a { color: #0066cc; }
      /* Hide distracting elements */
      nav, .nav, .navigation, .sidebar, .comments, #comments, .advertisement, .ads { display: none !important; }
    </style>
  `;

  cleanDoc.body.innerHTML = contentHtml;

  return cleanDoc.documentElement.outerHTML;
}

/**
 * Fetch content from a URL and create a document
 */
export async function importFromUrl(url: string): Promise<Omit<Document, 'id'>> {
  try {
    // Validate URL
    const validUrl = new URL(url);
    const hostname = validUrl.hostname;

    let title: string;
    let content: string;
    let filePath: string;
    let fileType: Document['fileType'] = 'html';
    let fetchMethod: 'direct' | 'proxy' = 'direct';

    // Check if this is a direct file link
    const isDirectFile = /\.(pdf|epub|md|markdown|txt|html?)$/i.test(validUrl.pathname);

    if (isDirectFile) {
      // For direct files, use the backend fetch
      const fetched = await fetchUrlContent(validUrl.toString());
      filePath = fetched.file_path;
      
      // Determine file type
      if (fetched.content_type.includes('pdf')) {
        fileType = 'pdf';
      } else if (fetched.content_type.includes('markdown') || fetched.content_type.includes('text/markdown')) {
        fileType = 'markdown';
      } else if (url.match(/\.(md|markdown)$/i)) {
        fileType = 'markdown';
      } else if (url.match(/\.(txt)$/i)) {
        fileType = 'other';
      }

      // Extract title from filename
      const urlParts = validUrl.pathname.split('/');
      const fileName = urlParts[urlParts.length - 1] || hostname;
      title = fileName.replace(/\.(html?|md|txt|pdf|epub)$/i, '') || `Web Content - ${hostname}`;

      // For HTML files, process the content
      if (fileType === 'html') {
        try {
          const base64Content = await readDocumentFile(fetched.file_path);
          const htmlContent = atob(base64Content);
          content = processHtmlContent(htmlContent, url, title);
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
      // For web pages, fetch via browser fetch with proxy fallback
      const { html, title: fetchedTitle, fetchMethod: method } = await fetchArticleWithProxy(url);
      fetchMethod = method;
      title = fetchedTitle;
      
      // Process HTML content
      content = processHtmlContent(html, url, title);
      
      // Store the HTML in a virtual file path for browser mode
      // In Tauri mode, the backend would have stored it
      if (isTauri()) {
        const fetched = await fetchUrlContent(validUrl.toString());
        filePath = fetched.file_path;
      } else {
        // Browser mode - use a virtual path
        filePath = `browser-fetched://article-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
    }

    // Extract additional metadata
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

    // Create document object with FSRS-compatible fields
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
export async function importFromArxiv(input: string): Promise<Omit<Document, 'id'>> {
  try {
    // Extract Arxiv ID from URL or direct input
    const arxivId = extractArxivId(input);
    if (!arxivId) {
      throw new Error('Invalid Arxiv ID or URL');
    }

    // Fetch paper metadata from Arxiv API
    const metadata = await fetchArxivMetadata(arxivId);

    // Download PDF using the backend fetch function
    const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
    const fetched = await fetchUrlContent(pdfUrl);

    // Create document object
    const document: Omit<Document, 'id'> = {
      title: metadata.title,
      filePath: fetched.file_path,
      fileType: 'pdf',
      content: metadata.abstract,
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

    // Extract authors
    const authors: string[] = [];
    entry.querySelectorAll('author name').forEach((author) => {
      authors.push(author.textContent || '');
    });

    // Extract categories
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
    // Return minimal metadata on error
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

    // Check protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are supported' };
    }

    // Check for common non-content URLs
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
