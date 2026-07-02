/**
 * RSS and Atom feed parser and management
 */

import { invokeCommand, isTauri } from "../lib/tauri";
import { useCollectionStore } from "../stores/collectionStore";

/**
 * Feed item (article/blog post)
 */
export interface FeedItem {
  id: string;
  title: string;
  description: string;
  content: string;
  link: string;
  pubDate: string;
  author?: string;
  categories: string[];
  enclosure?: {
    url: string;
    type: string;
    length?: number;
  };
  guid?: string;
  read: boolean;
  favorite: boolean;
  feedId: string;
  // Full content fields
  fullContent?: string;
  fullContentFetchedAt?: string;
  // Intelligence scoring
  intelligenceScore?: number;
  // Thumbnail
  thumbnail?: string;
}

/**
 * Feed metadata
 */
export interface Feed {
  id: string;
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  icon?: string;
  imageUrl?: string;
  language?: string;
  category?: string;
  lastUpdated: string;
  lastFetched: string;
  updateInterval: number; // in minutes
  items: FeedItem[];
  subscribeDate: string;
  unreadCount: number;
  // Full content auto-fetch setting: 'always', 'favorites', 'manual'
  autoFetchFullContent?: string;
  // Active state (disabled feeds still subscribed)
  isActive?: boolean;
  // View/layout preferences
  viewMode?: string;
  layout?: string;
  // Auto-mark-as-read after N days
  autoMarkAfterDays?: number;
}

/**
 * Feed folder for organization
 */
export interface FeedFolder {
  id: string;
  name: string;
  feeds: string[]; // feed IDs
}

function extractImageUrlFromHtml(html?: string | null): string | undefined {
  if (!html) return undefined;

  const imgMatch = html.match(/<img[^>]+src=["']([^"'#?][^"']*)["']/i);
  if (imgMatch?.[1]) {
    return imgMatch[1];
  }

  return undefined;
}

function getFeedItemThumbnail(item: {
  thumbnail?: string | null;
  image_url?: string | null;
  content?: string | null;
  description?: string | null;
  enclosure?: { url: string; type: string } | null;
}): string | undefined {
  if (item.thumbnail) return item.thumbnail;
  if (item.image_url) return item.image_url;
  if (item.enclosure?.type?.startsWith("image/") && item.enclosure.url) {
    return item.enclosure.url;
  }

  return extractImageUrlFromHtml(item.content) || extractImageUrlFromHtml(item.description);
}

/**
 * Resolves the favicon URL for a given feed with high-quality fallback using base domain
 */
export function getFeedIcon(feed: { imageUrl?: string; icon?: string; link?: string; feedUrl?: string }): string | undefined {
  if (feed.imageUrl && feed.imageUrl.trim()) return feed.imageUrl.trim();
  if (feed.icon && feed.icon.trim()) return feed.icon.trim();

  const urlString = feed.link || feed.feedUrl;
  if (!urlString) return undefined;

  try {
    const url = new URL(urlString.trim());
    return `https://www.google.com/s2/favicons?sz=64&domain=${url.hostname}`;
  } catch {
    return undefined;
  }
}

function normalizeKnownFeedUrl(feedUrl: string): string {
  switch (feedUrl.trim()) {
    case "https://feeds.nbcnews.com/nbcnews/topstories":
      return "https://feeds.nbcnews.com/nbcnews/public/news";
    default:
      return feedUrl.trim();
  }
}

/**
 * Parse RSS/Atom feed from XML string
 */
export function parseFeed(xmlText: string, feedUrl: string): Feed | null {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const parseError = xmlDoc.querySelector("parsererror");
  if (parseError) {
    console.error("XML parsing error:", parseError.textContent);
    return null;
  }

  // Detect feed type (RSS or Atom)
  const rssChannel = xmlDoc.querySelector("channel");
  const atomFeed = xmlDoc.querySelector("feed");

  if (rssChannel) {
    return parseRSS(xmlDoc, feedUrl);
  } else if (atomFeed) {
    return parseAtom(xmlDoc, feedUrl);
  }

  return null;
}

/**
 * Parse RSS feed
 */
function parseRSS(xmlDoc: Document, feedUrl: string): Feed | null {
  const channel = xmlDoc.querySelector("channel");
  if (!channel) return null;

  const title = getElementText(channel, "title") || "Unknown Feed";
  const description =
    getElementText(channel, "description") || getElementText(channel, "tagline") || "";
  const link = getElementText(channel, "link") || feedUrl;
  const imageUrl =
    getElementText(channel, "image > url") || getElementText(channel, "itunes\\:image") || "";
  const language = getElementText(channel, "language");
  const category = getElementText(channel, "category");

  const items = Array.from(channel.querySelectorAll("item"));
  const feedItems: FeedItem[] = items
    .map((item) => parseRSSItem(item))
    .filter((item): item is FeedItem => item !== null);

  return {
    id: generateFeedId(feedUrl),
    title,
    description,
    link,
    feedUrl,
    imageUrl,
    language,
    category,
    lastUpdated: new Date().toISOString(),
    lastFetched: new Date().toISOString(),
    updateInterval: 60, // Default 1 hour
    items: feedItems,
    subscribeDate: new Date().toISOString(),
    unreadCount: feedItems.filter((i) => !i.read).length,
  };
}

/**
 * Parse RSS item
 */
function parseRSSItem(item: Element): FeedItem | null {
  const title = getElementText(item, "title") || "Untitled";
  const description = getElementText(item, "description") || getElementText(item, "summary") || "";
  const link = getElementText(item, "link") || "";
  const pubDate = getElementText(item, "pubDate") || new Date().toISOString();
  const author = getElementText(item, "author") || getElementText(item, "dc\\:creator");
  const guid = getElementText(item, "guid");

  // Categories
  const categories = Array.from(item.querySelectorAll("category"))
    .map((cat) => cat.textContent?.trim())
    .filter((c): c is string => !!c);

  // Enclosure (podcast/media)
  const enclosureEl = item.querySelector("enclosure");
  let enclosure;
  if (enclosureEl) {
    enclosure = {
      url: enclosureEl.getAttribute("url") || "",
      type: enclosureEl.getAttribute("type") || "application/octet-stream",
      length: parseInt(enclosureEl.getAttribute("length") || "0") || undefined,
    };
  }

  const mediaContentEl =
    item.querySelector("media\\:content[url]") ||
    Array.from(item.children).find((child) => child.tagName.toLowerCase().includes("content"));
  const mediaThumbnailEl =
    item.querySelector("media\\:thumbnail[url]") ||
    Array.from(item.children).find((child) => child.tagName.toLowerCase().includes("thumbnail"));
  const itemImageUrl =
    mediaThumbnailEl?.getAttribute("url") ||
    getElementText(item, "itunes\\:image") ||
    mediaContentEl?.getAttribute("url") ||
    (enclosure?.type?.startsWith("image/") ? enclosure.url : undefined);

  // Try multiple approaches to handle namespaced elements
  let content = description;

  // Approach 1: Try the escaped colon selector
  const contentEl1 = item.querySelector("content\\:encoded");
  if (contentEl1?.textContent) {
    content = contentEl1.textContent;
  } else {
    // Approach 2: Try with namespace prefix handling
    const contentEl2 = item.querySelector("encoded");
    if (contentEl2?.textContent) {
      content = contentEl2.textContent;
    } else {
      // Approach 3: Iterate all child nodes to find content:encoded
      for (const child of Array.from(item.children)) {
        if (
          child.tagName.toLowerCase().includes("encoded") ||
          child.tagName === "content:encoded"
        ) {
          if (child.textContent) {
            content = child.textContent;
            break;
          }
        }
      }
    }
  }

  return {
    id: guid || generateItemId(link, pubDate),
    title,
    description,
    content,
    link,
    pubDate,
    author,
    categories,
    enclosure,
    guid,
    read: false,
    favorite: false,
    feedId: "", // Will be set by caller
    thumbnail: getFeedItemThumbnail({
      image_url: itemImageUrl,
      content,
      description,
      enclosure,
    }),
  };
}

/**
 * Parse Atom feed
 */
function parseAtom(xmlDoc: Document, feedUrl: string): Feed | null {
  const feed = xmlDoc.querySelector("feed");
  if (!feed) return null;

  const title = getElementText(feed, "title") || "Unknown Feed";
  const description = getElementText(feed, "subtitle") || getElementText(feed, "description") || "";
  const link = getAtomLink(feed) || feedUrl;
  const icon = getElementText(feed, "icon");
  const logo = getElementText(feed, "logo");
  const imageUrl = icon || logo;
  const language = feed.getAttribute("xml:lang") || undefined;

  const entries = Array.from(feed.querySelectorAll("entry"));
  const feedItems: FeedItem[] = entries
    .map((entry) => parseAtomEntry(entry))
    .filter((item): item is FeedItem => item !== null);

  return {
    id: generateFeedId(feedUrl),
    title,
    description,
    link,
    feedUrl,
    icon,
    imageUrl,
    language,
    lastUpdated: new Date().toISOString(),
    lastFetched: new Date().toISOString(),
    updateInterval: 60,
    items: feedItems,
    subscribeDate: new Date().toISOString(),
    unreadCount: feedItems.filter((i) => !i.read).length,
  };
}

/**
 * Parse Atom entry
 */
function parseAtomEntry(entry: Element): FeedItem | null {
  const title = getElementText(entry, "title") || "Untitled";
  const content = getElementText(entry, "content") || getElementText(entry, "summary") || "";
  const link = getAtomLink(entry) || "";
  const pubDate =
    getElementText(entry, "published") ||
    getElementText(entry, "updated") ||
    new Date().toISOString();
  const author = getElementText(entry, "author > name");

  // Categories/tags
  const categories = Array.from(entry.querySelectorAll("category"))
    .map((cat) => cat.getAttribute("label") || cat.getAttribute("term"))
    .filter((c): c is string => !!c);

  // Enclosure
  const enclosureEl = entry.querySelector("link[rel='enclosure']");
  let enclosure;
  if (enclosureEl) {
    enclosure = {
      url: enclosureEl.getAttribute("href") || "",
      type: enclosureEl.getAttribute("type") || "application/octet-stream",
      length: parseInt(enclosureEl.getAttribute("length") || "0") || undefined,
    };
  }

  const mediaThumbnailEl =
    entry.querySelector("media\\:thumbnail[url]") ||
    Array.from(entry.children).find((child) => child.tagName.toLowerCase().includes("thumbnail"));
  const mediaContentEl =
    entry.querySelector("media\\:content[url]") ||
    Array.from(entry.children).find((child) => child.tagName.toLowerCase().includes("content"));
  const itemImageUrl =
    mediaThumbnailEl?.getAttribute("url") ||
    mediaContentEl?.getAttribute("url") ||
    (enclosure?.type?.startsWith("image/") ? enclosure.url : undefined);

  const id = getElementText(entry, "id") || generateItemId(link, pubDate);

  return {
    id,
    title,
    description: content,
    content,
    link,
    pubDate,
    author,
    categories,
    enclosure,
    guid: id,
    read: false,
    favorite: false,
    feedId: "",
    thumbnail: getFeedItemThumbnail({
      image_url: itemImageUrl,
      content,
      description: content,
      enclosure,
    }),
  };
}

/**
 * Get Atom link element
 */
function getAtomLink(parent: Element): string | null {
  const linkEl = parent.querySelector("link[rel='alternate'], link:not([rel])");
  return linkEl?.getAttribute("href") || null;
}

/**
 * Helper to get element text content
 */
function getElementText(parent: Element | null, selector: string): string | null {
  if (!parent) return null;
  const element = parent.querySelector(selector);
  return element?.textContent?.trim() || null;
}

/**
 * Generate feed ID from URL
 */
function generateFeedId(feedUrl: string): string {
  let hash = 0;
  for (let i = 0; i < feedUrl.length; i++) {
    const char = feedUrl.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `feed-${Math.abs(hash)}`;
}

/**
 * Generate item ID
 */
function generateItemId(link: string, pubDate: string): string {
  return `item-${Math.abs(
    (link + pubDate).split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0)
  )}`;
}

/**
 * Fetch feed from URL using Tauri backend (bypasses CORS)
 */
export async function fetchFeed(feedUrl: string): Promise<Feed | null> {
  try {
    const normalizedFeedUrl = normalizeKnownFeedUrl(feedUrl);
    const parsedFeed = await invokeCommand<any>("fetch_rss_feed_url", { feedUrl: normalizedFeedUrl });

    // Convert backend format to frontend format
    const feed: Feed = {
      id: parsedFeed.id,
      title: parsedFeed.title,
      description: parsedFeed.description,
      link: parsedFeed.link,
      feedUrl: normalizeKnownFeedUrl(parsedFeed.feed_url),
      imageUrl: parsedFeed.image_url,
      language: parsedFeed.language,
      category: parsedFeed.category,
      lastUpdated: new Date().toISOString(),
      lastFetched: new Date().toISOString(),
      updateInterval: 60,
      items: parsedFeed.items.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        content: item.content,
        link: item.link,
        pubDate: item.pub_date,
        author: item.author,
        categories: item.categories || [],
        guid: item.guid,
        read: false,
        favorite: false,
        feedId: parsedFeed.id,
        thumbnail: getFeedItemThumbnail(item),
      })),
      subscribeDate: new Date().toISOString(),
      unreadCount: parsedFeed.items.length,
    };

    return feed;
  } catch (error) {
    console.error("Failed to fetch feed:", error);
    throw error;
  }
}

/**
 * Subscribe to feed
 */
export function subscribeToFeed(feed: Feed): void {
  const subscriptions = getSubscribedFeeds();

  if (subscriptions.find((f) => f.id === feed.id)) {
    updateFeed(feed.id, feed);
  } else {
    // Add new subscription
    subscriptions.push(feed);
    saveFeeds(subscriptions);
  }
}

/**
 * Unsubscribe from feed
 */
export function unsubscribeFromFeed(feedId: string): void {
  const subscriptions = getSubscribedFeeds();
  const filtered = subscriptions.filter((feed) => feed.id !== feedId);
  saveFeeds(filtered);
}

/**
 * Get all subscribed feeds
 */
export function getSubscribedFeeds(): Feed[] {
  try {
    const data = localStorage.getItem("rss_feeds");
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to parse RSS feeds from storage", e);
    return [];
  }
}

/**
 * Save feeds to localStorage with fallback pruning strategies
 */
function saveFeeds(feeds: Feed[]): void {
  try {
    localStorage.setItem("rss_feeds", JSON.stringify(feeds));
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22)
    ) {
      console.warn("[RSS] Storage quota exceeded. Attempting to prune old data...");

      // Strategy 1: Limit to 50 items per feed (most recent)
      let prunedFeeds = feeds.map((feed) => ({
        ...feed,
        items: feed.items
          .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
          .slice(0, 50),
      }));

      try {
        localStorage.setItem("rss_feeds", JSON.stringify(prunedFeeds));
        return;
      } catch {
        // Strategy 2: Remove content from read items (keep description)
        console.warn("[RSS] Still too large. Removing content from read items...");
        prunedFeeds = prunedFeeds.map((feed) => ({
          ...feed,
          items: feed.items.map((item) => (item.read ? { ...item, content: "" } : item)),
        }));

        try {
          localStorage.setItem("rss_feeds", JSON.stringify(prunedFeeds));
          return;
        } catch {
          // Strategy 3: Remove content from ALL items (keep description only)
          console.warn("[RSS] Still too large. Removing content from all items...");
          prunedFeeds = prunedFeeds.map((feed) => ({
            ...feed,
            items: feed.items.map((item) => ({ ...item, content: "" })),
          }));

          try {
            localStorage.setItem("rss_feeds", JSON.stringify(prunedFeeds));
            return;
          } catch (e4) {
            console.error("[RSS] Critical: Unable to save feeds even after pruning.", e4);
            throw e; // Throw original error to let caller know
          }
        }
      }
    }
    throw e; // Re-throw other errors
  }
}

/**
 * Get feed by ID
 */
export function getFeed(feedId: string): Feed | undefined {
  const feeds = getSubscribedFeeds();
  return feeds.find((feed) => feed.id === feedId);
}

/**
 * Update feed
 */
export function updateFeed(feedId: string, updates: Partial<Feed>): void {
  const feeds = getSubscribedFeeds();
  const index = feeds.findIndex((feed) => feed.id === feedId);

  if (index !== -1) {
    feeds[index] = { ...feeds[index], ...updates };
    saveFeeds(feeds);
  }
}

/**
 * Mark item as read
 */
/**
 * Build a minimal article-state wire object for the sync publish path. Identity
 * fields (url/title/guid) are pulled from the locally-cached item when present
 * so the receiver can create a stub article row on first sight; they're
 * optional because the field-LWW merge only needs the state + clocks. Used by
 * the read/queued publish hooks.
 */
function emptyArticleState(
  itemId: string,
  feedId: string,
  item?: { title?: string; url?: string; link?: string; guid?: string; published_date?: string; author?: string; image_url?: string; date_added?: string },
) {
  return {
    id: itemId,
    feed_id: feedId,
    url: item?.url ?? item?.link ?? `rss://${itemId}`,
    guid: item?.guid ?? null,
    title: item?.title ?? "",
    author: item?.author ?? null,
    published_date: item?.published_date ?? null,
    image_url: item?.image_url ?? null,
    is_read: false,
    read_at: null,
    unread_at: null,
    is_queued: false,
    queued_at: null,
    unqueued_at: null,
    updated_at: "",
    date_added: item?.date_added ?? new Date().toISOString(),
  };
}

export function markItemRead(feedId: string, itemId: string, read: boolean = true): void {
  const feed = getFeed(feedId);
  if (!feed) return;

  const item = feed.items.find((i) => i.id === itemId);
  if (item) {
    item.read = read;
    feed.unreadCount = feed.items.filter((i) => !i.read).length;
    updateFeed(feedId, feed);
  }
}

/**
 * Mark all items in feed as read
 */
export function markFeedRead(feedId: string): void {
  const feed = getFeed(feedId);
  if (!feed) return;

  feed.items.forEach((item) => (item.read = true));
  feed.unreadCount = 0;
  updateFeed(feedId, feed);
}

/**
 * Toggle item favorite
 */
export function toggleItemFavorite(feedId: string, itemId: string): void {
  const feed = getFeed(feedId);
  if (!feed) return;

  const item = feed.items.find((i) => i.id === itemId);
  if (item) {
    item.favorite = !item.favorite;
    updateFeed(feedId, feed);
  }
}

/**
 * Get all unread items
 */
export function getUnreadItems(): Array<{ feed: Feed; item: FeedItem }> {
  const feeds = getSubscribedFeeds();
  const results: Array<{ feed: Feed; item: FeedItem }> = [];

  feeds.forEach((feed) => {
    feed.items.forEach((item) => {
      if (!item.read) {
        results.push({ feed, item });
      }
    });
  });

  // Sort by pub date (newest first)
  results.sort((a, b) => new Date(b.item.pubDate).getTime() - new Date(a.item.pubDate).getTime());

  return results;
}

/**
 * Get favorite items
 */
export function getFavoriteItems(): Array<{ feed: Feed; item: FeedItem }> {
  const feeds = getSubscribedFeeds();
  const results: Array<{ feed: Feed; item: FeedItem }> = [];

  feeds.forEach((feed) => {
    feed.items.forEach((item) => {
      if (item.favorite) {
        results.push({ feed, item });
      }
    });
  });

  return results;
}

/**
 * Search feed items
 */
export function searchFeedItems(query: string): Array<{
  feed: Feed;
  item: FeedItem;
}> {
  const feeds = getSubscribedFeeds();
  const results: Array<{ feed: Feed; item: FeedItem }> = [];
  const lowerQuery = query.toLowerCase();

  feeds.forEach((feed) => {
    feed.items.forEach((item) => {
      if (
        item.title.toLowerCase().includes(lowerQuery) ||
        item.description.toLowerCase().includes(lowerQuery) ||
        item.content.toLowerCase().includes(lowerQuery)
      ) {
        results.push({ feed, item });
      }
    });
  });

  return results;
}

/**
 * Get feed folders
 */
export function getFeedFolders(): FeedFolder[] {
  const data = localStorage.getItem("rss_folders");
  return data ? JSON.parse(data) : [];
}

/**
 * Save feed folders
 */
function saveFeedFolders(folders: FeedFolder[]): void {
  localStorage.setItem("rss_folders", JSON.stringify(folders));
}

/**
 * Create folder
 */
export function createFolder(name: string): FeedFolder {
  const folders = getFeedFolders();
  const folder: FeedFolder = {
    id: `folder-${Date.now()}`,
    name,
    feeds: [],
  };
  folders.push(folder);
  saveFeedFolders(folders);
  return folder;
}

/**
 * Add feed to folder
 */
export function addFeedToFolder(folderId: string, feedId: string): void {
  const folders = getFeedFolders();
  const folder = folders.find((f) => f.id === folderId);
  if (folder && !folder.feeds.includes(feedId)) {
    folder.feeds.push(feedId);
    saveFeedFolders(folders);
  }
}

/**
 * Import OPML file
 */
export function importOPML(opmlContent: string): Feed[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(opmlContent, "text/xml");

  const feeds: Feed[] = [];
  const seenUrls = new Set<string>();

  const parseOutline = (outline: Element, category?: string) => {
    const xmlUrl = outline.getAttribute("xmlUrl");
    const htmlUrl = outline.getAttribute("htmlUrl");
    const title = outline.getAttribute("title") || outline.getAttribute("text") || "Unknown Feed";
    const childOutlines = Array.from(outline.children).filter(
      (child) => child.tagName.toLowerCase() === "outline"
    );

    if (xmlUrl) {
      const trimmedUrl = xmlUrl.trim();
      if (!/^https?:\/\//i.test(trimmedUrl)) {
        return;
      }
      if (seenUrls.has(trimmedUrl)) {
        return;
      }
      seenUrls.add(trimmedUrl);
      feeds.push({
        id: generateFeedId(trimmedUrl),
        title,
        description: "",
        link: htmlUrl || trimmedUrl,
        feedUrl: trimmedUrl,
        category,
        lastUpdated: new Date().toISOString(),
        lastFetched: new Date().toISOString(),
        updateInterval: 60,
        items: [],
        subscribeDate: new Date().toISOString(),
        unreadCount: 0,
        autoMarkAfterDays: undefined,
      });
      return;
    }

    if (childOutlines.length > 0) {
      const nextCategory = title || category;
      childOutlines.forEach((child) => parseOutline(child, nextCategory));
    }
  };

  const rootOutlines = Array.from(xmlDoc.querySelectorAll("body > outline"));
  if (rootOutlines.length > 0) {
    rootOutlines.forEach((outline) => parseOutline(outline));
  } else {
    const outlines = Array.from(xmlDoc.querySelectorAll("outline"));
    outlines.forEach((outline) => parseOutline(outline));
  }

  return feeds;
}

/**
 * Export feeds to OPML
 */
export function exportOPML(): string {
  const feeds = getSubscribedFeeds();

  let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Incrementum Feed Subscriptions</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
`;

  feeds.forEach((feed) => {
    opml += `    <outline type="rss" text="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.feedUrl)}" htmlUrl="${escapeXml(feed.link)}"/>\n`;
  });

  // Add folder hierarchy from localStorage
  const foldersJson = localStorage.getItem("rss_folders");
  if (foldersJson) {
    try {
      const folders: Array<{id: string; name: string; feeds: string[]}> = JSON.parse(foldersJson);
      folders.forEach((folder) => {
        opml += `    <outline text="${escapeXml(folder.name)}" title="${escapeXml(folder.name)}">\n`;
        folder.feeds.forEach((feedId) => {
          const feed = feeds.find((f) => f.feedUrl === feedId || f.id === feedId);
          if (feed) {
            opml += `      <outline type="rss" text="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.feedUrl)}" htmlUrl="${escapeXml(feed.link)}"/>\n`;
          }
        });
        opml += `    </outline>\n`;
      });
    } catch { /* ignore feed iteration errors */ }
  }

  opml += `  </body>
</opml>`;

  return opml;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format date for display
 */
export function formatFeedDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Get the base URL for HTTP API calls
 */
function getApiBaseUrl(): string {
  // Default to localhost for development
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? `${window.location.protocol}//${window.location.hostname}:8766`
    : `${window.location.protocol}//${window.location.hostname}`;
}

/**
 * Check if HTTP RSS backend is available (web dev server)
 */
function shouldUseHttpBackend(): boolean {
  if (isTauri()) {
    return false;
  }
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * HTTP-based RSS feed API response from backend
 */
interface BackendRssFeed {
  id: string;
  url: string;
  title: string;
  description: string | null;
  category: string | null;
  update_interval: number;
  last_fetched: string | null;
  is_active: boolean;
  date_added: string;
  auto_queue: boolean;
}

interface BackendRssArticle {
  id: string;
  feed_id: string;
  url: string;
  guid: string | null;
  title: string;
  author: string | null;
  published_date: string | null;
  content: string | null;
  summary: string | null;
  image_url: string | null;
  is_queued: boolean;
  is_read: boolean;
  date_added: string;
  intelligence_score?: number | null;
}

interface TauriRssFeed {
  id: string;
  url: string;
  title: string;
  description: string | null;
  category: string | null;
  update_interval: number;
  last_fetched: string | null;
  is_active: boolean;
  date_added: string;
  auto_queue: boolean;
}

interface TauriRssArticle {
  id: string;
  feed_id: string;
  url: string;
  guid: string | null;
  title: string;
  author: string | null;
  published_date: string | null;
  content: string | null;
  summary: string | null;
  image_url: string | null;
  is_queued: boolean;
  is_read: boolean;
  date_added: string;
  intelligence_score: number | null;
}

/**
 * Convert backend RSS feed format to frontend format
 */
function backendFeedToFrontend(
  feed: BackendRssFeed & { unread_count?: number },
  items: BackendRssArticle[] = []
): Feed {
  const normalizedFeedUrl = normalizeKnownFeedUrl(feed.url);
  return {
    id: feed.id,
    title: feed.title,
    description: feed.description || "",
    link: normalizedFeedUrl,
    feedUrl: normalizedFeedUrl,
    imageUrl: undefined,
    language: undefined,
    category: feed.category || undefined,
    lastUpdated: feed.date_added,
    lastFetched: feed.last_fetched || feed.date_added,
    updateInterval: Math.floor(feed.update_interval / 60), // Convert seconds to minutes
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.summary || "",
      content: item.content || "",
      link: item.url,
      pubDate: item.published_date || item.date_added,
      author: item.author || undefined,
      categories: [],
      guid: item.guid || undefined,
      read: item.is_read,
      favorite: item.is_queued,
      feedId: feed.id,
      intelligenceScore: item.intelligence_score ?? undefined,
      thumbnail: getFeedItemThumbnail(item),
    })),
    subscribeDate: feed.date_added,
    unreadCount: feed.unread_count ?? 0,
  };
}

function tauriFeedToFrontend(feed: TauriRssFeed, items: TauriRssArticle[] = []): Feed {
  const normalizedFeedUrl = normalizeKnownFeedUrl(feed.url);
  return {
    id: feed.id,
    title: feed.title,
    description: feed.description || "",
    link: normalizedFeedUrl,
    feedUrl: normalizedFeedUrl,
    imageUrl: undefined,
    language: undefined,
    category: feed.category || undefined,
    lastUpdated: feed.date_added,
    lastFetched: feed.last_fetched || feed.date_added,
    updateInterval: Math.floor(feed.update_interval / 60),
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.summary || "",
      content: item.content || "",
      link: item.url,
      pubDate: item.published_date || item.date_added,
      author: item.author || undefined,
      categories: [],
      guid: item.guid || undefined,
      read: item.is_read,
      favorite: item.is_queued,
      feedId: feed.id,
      intelligenceScore: item.intelligence_score ?? undefined,
      thumbnail: getFeedItemThumbnail(item),
    })),
    subscribeDate: feed.date_added,
    unreadCount: items.filter((item) => !item.is_read).length,
  };
}

async function getFeedsViaTauri(): Promise<Feed[]> {
  const collectionId = useCollectionStore.getState().activeCollectionId;
  const feeds = await invokeCommand<TauriRssFeed[]>("get_rss_feeds", {
    collectionId,
    collection_id: collectionId,
  });
  const feedsWithItems = await Promise.all(
    feeds.map(async (feed) => {
      const articles = await invokeCommand<TauriRssArticle[]>("get_rss_articles", {
        feedId: feed.id,
        feed_id: feed.id,
        limit: 50,
      });
      return tauriFeedToFrontend(feed, articles);
    })
  );

  return feedsWithItems;
}

async function createOrUpdateFeedViaTauri(
  feed: Feed
): Promise<{ feed: TauriRssFeed; created: boolean }> {
  const normalizedFeedUrl = normalizeKnownFeedUrl(feed.feedUrl);
  const collectionId = useCollectionStore.getState().activeCollectionId;
  const existingFeeds = await invokeCommand<TauriRssFeed[]>("get_rss_feeds", {
    collectionId,
    collection_id: collectionId,
  });
  const existing = existingFeeds.find(
    (candidate) => normalizeKnownFeedUrl(candidate.url) === normalizedFeedUrl
  );
  const updateIntervalSeconds = Math.max(1, Math.round(feed.updateInterval * 60));

  if (existing) {
    const updatePayload: Record<string, unknown> = { id: existing.id };

    if (feed.title) updatePayload.title = feed.title;
    if (feed.description) updatePayload.description = feed.description;
    if (feed.category) updatePayload.category = feed.category;
    if (Number.isFinite(updateIntervalSeconds)) {
      updatePayload.updateInterval = updateIntervalSeconds;
      updatePayload.update_interval = updateIntervalSeconds;
    }

    await invokeCommand("update_rss_feed", updatePayload);
    return { feed: existing, created: false };
  }

  const created = await invokeCommand<TauriRssFeed>("create_rss_feed", {
    url: normalizedFeedUrl,
    title: feed.title,
    description: feed.description || null,
    category: feed.category || null,
    updateInterval: updateIntervalSeconds,
    update_interval: updateIntervalSeconds,
    autoQueue: false,
    auto_queue: false,
    collectionId: collectionId ?? undefined,
    collection_id: collectionId ?? undefined,
  });

  return { feed: created, created: true };
}

async function createArticlesViaTauri(feedId: string, items: FeedItem[]): Promise<void> {
  if (items.length === 0) return;

  const feed = getFeed(feedId);
  const shouldAutoFetch = feed?.autoFetchFullContent === "always";

  await Promise.all(
    items.map((item) =>
      invokeCommand("create_rss_article", {
        feedId,
        feed_id: feedId,
        url: item.link,
        guid: item.guid || null,
        title: item.title,
        author: item.author || null,
        publishedDate: item.pubDate || null,
        published_date: item.pubDate || null,
        content: item.content || null,
        summary: item.description || null,
        imageUrl: getFeedItemThumbnail(item) || null,
        image_url: getFeedItemThumbnail(item) || null,
      })
    )
  );

  // Trigger auto-fetch for "always" mode feeds after articles are created
  if (shouldAutoFetch) {
    items.forEach((item) => {
      void fetchArticleFullContent(item.id, item.link);
    });
  }
}

function getFeedItemKey(item: FeedItem): string {
  return item.link || item.guid || item.id;
}

export async function syncFeedToTauri(feed: Feed, existingItems: FeedItem[] = []): Promise<void> {
  const { feed: tauriFeed } = await createOrUpdateFeedViaTauri(feed);
  const existingKeys = new Set(existingItems.map(getFeedItemKey));
  const newItems = feed.items.filter((item) => !existingKeys.has(getFeedItemKey(item)));

  if (newItems.length > 0) {
    await createArticlesViaTauri(tauriFeed.id, newItems);
  }
}

/**
 * Create an RSS feed subscription via HTTP API
 */
export async function createFeedViaHttp(feedUrl: string): Promise<Feed> {
  const normalizedFeedUrl = normalizeKnownFeedUrl(feedUrl);
  const response = await fetch(
    `${getApiBaseUrl()}/api/rss/fetch?url=${encodeURIComponent(normalizedFeedUrl)}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.statusText}`);
  }

  const parsedFeed = await response.json();

  // Now create the subscription
  const createResponse = await fetch(`${getApiBaseUrl()}/api/rss/feeds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: normalizedFeedUrl,
      title: parsedFeed.title,
      description: parsedFeed.description,
      category: parsedFeed.category,
      update_interval: 3600, // 1 hour
      auto_queue: false,
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Failed to create feed: ${createResponse.statusText}`);
  }

  const createdFeed = await createResponse.json();
  return backendFeedToFrontend(createdFeed);
}

/**
 * Get all RSS feeds via HTTP API
 */
export async function getFeedsViaHttp(): Promise<Feed[]> {
  const response = await fetch(`${getApiBaseUrl()}/api/rss/feeds`);

  if (!response.ok) {
    throw new Error(`Failed to fetch feeds: ${response.statusText}`);
  }

  const feeds: Array<BackendRssFeed & { unread_count: number }> = await response.json();

  const feedsWithItems = await Promise.all(
    feeds.map(async (feed) => {
      const articlesResponse = await fetch(
        `${getApiBaseUrl()}/api/rss/feeds/${feed.id}/articles?limit=50`
      );
      if (articlesResponse.ok) {
        const articles: BackendRssArticle[] = await articlesResponse.json();
        return backendFeedToFrontend(feed, articles);
      }
      return backendFeedToFrontend(feed);
    })
  );

  return feedsWithItems;
}

/**
 * Get articles for a specific feed via HTTP API
 */
export async function getArticlesViaHttp(
  feedId: string,
  limit: number = 50
): Promise<BackendRssArticle[]> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/rss/feeds/${feedId}/articles?limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch articles: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Mark article as read/unread via HTTP API
 */
export async function markArticleReadViaHttp(articleId: string, isRead: boolean): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/rss/articles/${articleId}?read=${isRead}`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to mark article: ${response.statusText}`);
  }
}

/**
 * Delete RSS feed via HTTP API
 */
export async function deleteFeedViaHttp(feedId: string): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/rss/feeds/${feedId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete feed: ${response.statusText}`);
  }
}

/**
 * Import OPML via HTTP API
 */
export async function importOpmlViaHttp(
  opmlContent: string
): Promise<{ imported: number; errors: string[] }> {
  const response = await fetch(`${getApiBaseUrl()}/api/rss/opml/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opml_content: opmlContent }),
  });

  if (!response.ok) {
    throw new Error(`Failed to import OPML: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Export OPML via HTTP API
 */
export async function exportOpmlViaHttp(): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/api/rss/opml/export`);

  if (!response.ok) {
    throw new Error(`Failed to export OPML: ${response.statusText}`);
  }

  const data = await response.json();
  return data.opml_content;
}

/**
 * RSS User Preference types
 */
export interface RssUserPreference {
  id: string;
  user_id?: string;
  feed_id?: string;
  keyword_include?: string | null;
  keyword_exclude?: string | null;
  author_whitelist?: string | null;
  author_blacklist?: string | null;
  category_filter?: string | null;
  view_mode?: string | null;
  theme_mode?: string | null;
  density?: string | null;
  column_count?: number | null;
  show_thumbnails?: boolean | null;
  excerpt_length?: number | null;
  show_author?: boolean | null;
  show_date?: boolean | null;
  show_feed_icon?: boolean | null;
  sort_by?: string | null;
  sort_order?: string | null;
  // Reader preferences
  font_family?: string | null;
  font_size?: number | null;
  line_height?: number | null;
  content_width?: number | null;
  text_align?: string | null;
  date_created: string;
  date_modified: string;
}

export interface RssUserPreferenceUpdate {
  keyword_include?: string | null;
  keyword_exclude?: string | null;
  author_whitelist?: string | null;
  author_blacklist?: string | null;
  category_filter?: string | null;
  view_mode?: string | null;
  theme_mode?: string | null;
  density?: string | null;
  column_count?: number | null;
  show_thumbnails?: boolean | null;
  excerpt_length?: number | null;
  show_author?: boolean | null;
  show_date?: boolean | null;
  show_feed_icon?: boolean | null;
  sort_by?: string | null;
  sort_order?: string | null;
  // Reader preferences
  font_family?: string | null;
  font_size?: number | null;
  line_height?: number | null;
  content_width?: number | null;
  text_align?: string | null;
}

/**
 * Get RSS user preferences via HTTP API
 */
export async function getRssPreferencesViaHttp(feedId?: string): Promise<RssUserPreference> {
  const params = new URLSearchParams();
  if (feedId) params.append("feed_id", feedId);

  const response = await fetch(`${getApiBaseUrl()}/api/rss/preferences?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to get preferences: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Set RSS user preferences via HTTP API
 */
export async function setRssPreferencesViaHttp(
  preferences: RssUserPreferenceUpdate,
  feedId?: string
): Promise<RssUserPreference> {
  const params = new URLSearchParams();
  if (feedId) params.append("feed_id", feedId);

  const response = await fetch(`${getApiBaseUrl()}/api/rss/preferences?${params}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  });

  if (!response.ok) {
    throw new Error(`Failed to set preferences: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Unified getRssPreferences - works in both Tauri and Web mode
 */
export async function getRssPreferencesAuto(feedId?: string): Promise<RssUserPreference> {
  if (shouldUseHttpBackend()) {
    return await getRssPreferencesViaHttp(feedId);
  }

  const defaults: RssUserPreference = {
    id: "default",
    feed_id: feedId,
    view_mode: "card",
    theme_mode: "system",
    density: "normal",
    column_count: 2,
    show_thumbnails: true,
    excerpt_length: 150,
    show_author: true,
    show_date: true,
    show_feed_icon: true,
    sort_by: "date",
    sort_order: "desc",
    font_family: '"Iowan Old Style", "Charter", "Source Serif 4", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
    font_size: 16,
    line_height: 1.6,
    content_width: 65,
    text_align: "left",
    date_created: new Date().toISOString(),
    date_modified: new Date().toISOString(),
  };

  try {
    const key = feedId ? `rss_prefs_${feedId}` : "rss_prefs_global";
    const data = localStorage.getItem(key);
    if (data) {
      return { ...defaults, ...JSON.parse(data) };
    }

    if (feedId) {
      // Fallback to global preferences if feed-specific ones do not exist
      const globalData = localStorage.getItem("rss_prefs_global");
      if (globalData) {
        return { ...defaults, ...JSON.parse(globalData), feed_id: feedId };
      }
    }
  } catch (error) {
    console.error("Failed to load preferences from localStorage:", error);
  }

  return defaults;
}

/**
 * Unified setRssPreferences - works in both Tauri and Web mode
 */
export async function setRssPreferencesAuto(
  preferences: RssUserPreferenceUpdate,
  feedId?: string
): Promise<RssUserPreference> {
  if (shouldUseHttpBackend()) {
    return await setRssPreferencesViaHttp(preferences, feedId);
  }
  // In Tauri mode, save to localStorage for now
  // TODO: Integrate with Tauri command once implemented
  const key = feedId ? `rss_prefs_${feedId}` : "rss_prefs_global";
  localStorage.setItem(key, JSON.stringify(preferences));

  return {
    id: "default",
    feed_id: feedId,
    ...preferences,
    date_created: new Date().toISOString(),
    date_modified: new Date().toISOString(),
  } as RssUserPreference;
}

/**
 * Unified getSubscribedFeeds - works in both Tauri and Web mode
 */
export async function getSubscribedFeedsAuto(): Promise<Feed[]> {
  if (isTauri()) {
    try {
      return await getFeedsViaTauri();
    } catch (error) {
      console.warn("[RSS] Tauri backend unavailable, falling back to local feeds.", error);
      return getSubscribedFeeds();
    }
  }
  if (shouldUseHttpBackend()) {
    try {
      return await getFeedsViaHttp();
    } catch (error) {
      console.warn("[RSS] HTTP backend unavailable, falling back to local feeds.", error);
      return getSubscribedFeeds();
    }
  }
  return getSubscribedFeeds();
}

export async function getUnreadItemsAuto(): Promise<Array<{ feed: Feed; item: FeedItem }>> {
  const feeds = await getSubscribedFeedsAuto();
  const results: Array<{ feed: Feed; item: FeedItem }> = [];

  feeds.forEach((feed) => {
    feed.items.forEach((item) => {
      if (!item.read) {
        results.push({ feed, item });
      }
    });
  });

  results.sort((a, b) => new Date(b.item.pubDate).getTime() - new Date(a.item.pubDate).getTime());

  return results;
}

/**
 * Unified subscribeToFeed - works in both Tauri and Web mode
 */
export async function subscribeToFeedAuto(feed: Feed): Promise<void> {
  if (isTauri()) {
    try {
      const { feed: createdFeed, created } = await createOrUpdateFeedViaTauri(feed);
      if (created) {
        await createArticlesViaTauri(createdFeed.id, feed.items);
      }
      // Auto-detect favicon
      try {
        const baseUrl = new URL(feed.feedUrl).origin;
        const iconUrl = `${baseUrl}/favicon.ico`;
        const response = await fetch(iconUrl, { method: "HEAD", mode: "no-cors" });
        if (response.ok) {
          feed.icon = iconUrl;
        }
      } catch { /* ignore feed iteration errors */ }
      return;
    } catch (error) {
      console.warn("[RSS] Tauri backend unavailable, storing feed locally.", error);
    }
  }
  if (shouldUseHttpBackend()) {
    try {
      await createFeedViaHttp(feed.feedUrl);
      return;
    } catch (error) {
      console.warn("[RSS] HTTP backend unavailable, storing feed locally.", error);
    }
  }
  subscribeToFeed(feed);
}

/**
 * Unified unsubscribeFromFeed - works in both Tauri and Web mode
 */
export async function unsubscribeFromFeedAuto(feedId: string): Promise<void> {
  if (shouldUseHttpBackend()) {
    try {
      await deleteFeedViaHttp(feedId);
      return;
    } catch (error) {
      console.warn("[RSS] HTTP backend unavailable, removing local feed.", error);
    }
  }
  unsubscribeFromFeed(feedId);
}

/**
 * Unified markItemRead - works in both Tauri and Web mode
 */
export async function markItemReadAuto(
  feedId: string,
  itemId: string,
  read: boolean = true
): Promise<void> {
  if (isTauri()) {
    // In Tauri mode, use the backend command to update SQLite
    await invokeCommand("mark_rss_article_read", { id: itemId, isRead: read, is_read: read });
    // Replicate the read-state change. Fire-and-forget so the UI never waits
    // on sync. The field-LWW merge uses the transition clock so two devices
    // toggling concurrently resolve deterministically (the newer wins).
    void (async () => {
      try {
        const { publishRssArticleReadState } = await import("../lib/sync/entities/rss");
        await publishRssArticleReadState({
          article: emptyArticleState(itemId, feedId),
          isRead: read,
        });
      } catch (err) {
        console.warn("[RSS] sync publish read-state failed (non-fatal)", err);
      }
    })();
    return;
  }
  if (shouldUseHttpBackend()) {
    try {
      await markArticleReadViaHttp(itemId, read);
      return;
    } catch (error) {
      console.warn("[RSS] HTTP backend unavailable, updating local item.", error);
    }
  }
  markItemRead(feedId, itemId, read);
}

/**
 * Unified markFeedRead - works in both Tauri and Web mode
 */
export async function markFeedReadAuto(feedId: string): Promise<void> {
  if (isTauri()) {
    try {
      await invokeCommand("mark_rss_feed_read", { feedId });
      return;
    } catch (error) {
      console.warn("[RSS] Tauri markFeedRead failed, falling back.", error);
    }
  }
  if (shouldUseHttpBackend()) {
    try {
      // In web mode, mark all articles for this feed as read
      const articles = await getArticlesViaHttp(feedId, 1000);
      await Promise.all(articles.map((a) => markArticleReadViaHttp(a.id, true)));
      return;
    } catch (error) {
      console.warn("[RSS] HTTP backend unavailable, updating local feed.", error);
    }
  }
  markFeedRead(feedId);
}

/**
 * Unified toggleItemFavorite - works in both Tauri and Web mode
 * Also triggers auto-fetch for "favorites" mode feeds
 */
export async function toggleItemFavoriteAuto(feedId: string, itemId: string): Promise<void> {
  const feed = getFeed(feedId);
  const item = feed?.items.find((i) => i.id === itemId);

  if (isTauri()) {
    await invokeCommand("toggle_rss_article_queued", { id: itemId });
    // Replicate the queued (star/save) state. Fire-and-forget.
    void (async () => {
      try {
        const { publishRssArticleQueuedState } = await import("../lib/sync/entities/rss");
        await publishRssArticleQueuedState({
          article: emptyArticleState(itemId, feedId, item),
          isQueued: !item?.favorite,
        });
      } catch (err) {
        console.warn("[RSS] sync publish queued-state failed (non-fatal)", err);
      }
    })();
  } else if (shouldUseHttpBackend()) {
    try {
      // In HTTP-backed mode, queued status is used as the persisted favorite flag.
      await fetch(`${getApiBaseUrl()}/api/rss/articles/${itemId}/queued`, {
        method: "POST",
      });
    } catch (error) {
      console.warn("[RSS] HTTP backend unavailable, updating local item.", error);
      toggleItemFavorite(feedId, itemId);
    }
  } else {
    toggleItemFavorite(feedId, itemId);
  }

  // Trigger auto-fetch if feed is in "favorites" mode and item was favorited
  if (feed && item && feed.autoFetchFullContent === "favorites") {
    const updatedItem = getFeed(feedId)?.items.find((i) => i.id === itemId);
    if (updatedItem?.favorite && !updatedItem.fullContent) {
      void fetchArticleFullContent(itemId, item.link);
    }
  }
}

/**
 * Unified importOPML - works in both Tauri and Web mode
 */
export async function importOpmlAuto(opmlContent: string): Promise<Feed[]> {
  if (shouldUseHttpBackend()) {
    try {
      await importOpmlViaHttp(opmlContent);
      // Return empty array since the backend handles the import
      return [];
    } catch (error) {
      console.warn("[RSS] HTTP OPML import failed, falling back to local import.", error);
      return importOPML(opmlContent);
    }
  }
  return importOPML(opmlContent);
}

/**
 * Unified exportOPML - works in both Tauri and Web mode
 */
export async function exportOpmlAuto(): Promise<string> {
  if (shouldUseHttpBackend()) {
    return await exportOpmlViaHttp();
  }
  return exportOPML();
}

/**
 * Newsletter platform detection result
 */
export interface NewsletterFeedResult {
  feedUrl: string;
  platform: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Discover RSS feed URL from a newsletter/web URL
 * Attempts to auto-detect the feed URL for popular platforms
 */
export async function discoverNewsletterFeedUrl(url: string): Promise<NewsletterFeedResult | null> {
  try {
    const normalizedUrl = normalizeUrl(url);

    // Try known platform patterns first (high confidence)
    const platformResult = detectPlatformFeed(normalizedUrl);
    if (platformResult) {
      // Verify the feed URL is valid
      const isValid = await verifyFeedUrl(platformResult.feedUrl);
      if (isValid) {
        return platformResult;
      }
    }

    // Try custom domain detection for Substack (handles rohan-paul.com style URLs)
    const substackResult = await detectSubstackCustomDomain(normalizedUrl);
    if (substackResult) {
      const isValid = await verifyFeedUrl(substackResult.feedUrl);
      if (isValid) {
        return substackResult;
      }
    }

    // Try custom domain detection for Beehiiv
    const beehiivResult = await detectBeehiivCustomDomain(normalizedUrl);
    if (beehiivResult) {
      const isValid = await verifyFeedUrl(beehiivResult.feedUrl);
      if (isValid) {
        return beehiivResult;
      }
    }

    // Try custom domain detection for Ghost
    const ghostResult = await detectGhostBlog(normalizedUrl);
    if (ghostResult) {
      const isValid = await verifyFeedUrl(ghostResult.feedUrl);
      if (isValid) {
        return ghostResult;
      }
    }

    // Try generic RSS auto-discovery (medium confidence)
    const genericResult = await discoverGenericFeed(normalizedUrl);
    if (genericResult) {
      return genericResult;
    }

    return null;
  } catch (error) {
    console.error("[Newsletter Discovery] Failed to discover feed:", error);
    return null;
  }
}

/**
 * Normalize URL by ensuring it has a protocol and removing trailing slashes
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim();

  // Add protocol if missing
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  normalized = normalized.replace(/\/$/, "");

  return normalized;
}

/**
 * Detect feed URL based on known platform patterns
 */
function detectPlatformFeed(url: string): NewsletterFeedResult | null {
  const hostname = new URL(url).hostname.toLowerCase();

  // Substack: https://author.substack.com -> https://author.substack.com/feed
  if (hostname.includes("substack.com")) {
    return {
      feedUrl: `${url}/feed`,
      platform: "Substack",
      confidence: "high",
    };
  }

  // Beehiiv: https://newsletter.beehiiv.com -> https://newsletter.beehiiv.com/feed
  if (hostname.includes("beehiiv.com")) {
    return {
      feedUrl: `${url}/feed`,
      platform: "Beehiiv",
      confidence: "high",
    };
  }

  // Ghost: Most Ghost blogs use /rss/
  if (hostname.includes(".ghost.io") || hostname.includes("ghost.org")) {
    return {
      feedUrl: `${url}/rss/`,
      platform: "Ghost",
      confidence: "high",
    };
  }

  // Buttondown: https://buttondown.email/newsletter -> https://buttondown.email/newsletter/feed
  if (hostname.includes("buttondown.email")) {
    return {
      feedUrl: `${url}/feed`,
      platform: "Buttondown",
      confidence: "high",
    };
  }

  // ConvertKit: Try /feed first
  if (hostname.includes("ck.page")) {
    return {
      feedUrl: `${url}/feed`,
      platform: "ConvertKit",
      confidence: "medium",
    };
  }

  // Revue: Try /feed first
  if (hostname.includes("getrevue.co")) {
    return {
      feedUrl: `${url}/feed`,
      platform: "Revue",
      confidence: "high",
    };
  }

  // Medium: Try /feed/
  if (hostname.includes("medium.com")) {
    return {
      feedUrl: `${url}/feed/`,
      platform: "Medium",
      confidence: "medium",
    };
  }

  // WordPress sites often use /feed/
  // We'll try this as a fallback

  return null;
}

/**
 * Detect if a custom domain is running Substack
 * This handles cases like https://www.rohan-paul.com/ which use Substack on custom domains
 */
async function detectSubstackCustomDomain(url: string): Promise<NewsletterFeedResult | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; RSS Reader Bot)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Substack detection indicators (in order of confidence)
    const indicators = {
      // High confidence: Generator meta tag
      generator: /<meta[^>]*name=["']generator["'][^>]*content=["'][^"']*Substack/i.test(html),

      // High confidence: Substack CDN links
      cdn: /substackcdn\.com|substack\.com\/min\/main/.test(html),

      // High confidence: Substack-specific scripts
      scripts: /window\.__SUBSTACK_UI|window\.__SUBSTACK_PUBLICations/.test(html),

      // High confidence: Feed link with substack
      feedLink:
        /<link[^>]*type=["']application\/rss\+xml["'][^>]*href=["'][^"']*substack\.com/i.test(html),

      // Medium confidence: Substack data attributes
      dataAttrs: /data-substack|data-publication/i.test(html),

      // Medium confidence: Substack-specific CSS classes
      css: /\.substack-|substack-wrapper|publication-content/.test(html),

      // Medium confidence: Substack JSON-LD
      jsonLd: /"@type":\s*"NewsArticle"[^}]*substack/i.test(html),
    };

    // Calculate confidence score
    const highConfidenceCount = [
      indicators.generator,
      indicators.cdn,
      indicators.scripts,
      indicators.feedLink,
    ].filter(Boolean).length;
    const mediumConfidenceCount = [indicators.dataAttrs, indicators.css, indicators.jsonLd].filter(
      Boolean
    ).length;

    // Determine if this is likely a Substack site
    const isSubstack = highConfidenceCount >= 1 || highConfidenceCount + mediumConfidenceCount >= 2;

    if (!isSubstack) {
      return null;
    }

    // Determine confidence level
    let confidence: "high" | "medium" | "low" = "low";
    if (highConfidenceCount >= 2) {
      confidence = "high";
    } else if (highConfidenceCount >= 1 || mediumConfidenceCount >= 2) {
      confidence = "medium";
    }

    // Try to find the actual feed URL
    // First, look for RSS link in HTML
    const feedMatch = html.match(
      /<link[^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i
    );
    if (feedMatch) {
      const feedUrl = new URL(feedMatch[1], url).toString();
      return {
        feedUrl,
        platform: "Substack",
        confidence,
      };
    }

    // Try common Substack feed patterns
    const feedPatterns = [`${url}/feed`, `${url}/feed.xml`];

    for (const feedUrl of feedPatterns) {
      try {
        const isValid = await verifyFeedUrl(feedUrl);
        if (isValid) {
          return {
            feedUrl,
            platform: "Substack",
            confidence,
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error("[Substack Detection] Failed:", error);
    return null;
  }
}

/**
 * Detect Beehiiv custom domain
 */
async function detectBeehiivCustomDomain(url: string): Promise<NewsletterFeedResult | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Beehiiv indicators
    const isBeehiiv = /beehiiv\.com|beehiiv-cdn|window\.__BEEHIIV/.test(html);

    if (!isBeehiiv) return null;

    // Try feed patterns
    const feedPatterns = [`${url}/feed`, `${url}/feed.xml`];

    for (const feedUrl of feedPatterns) {
      const isValid = await verifyFeedUrl(feedUrl);
      if (isValid) {
        return {
          feedUrl,
          platform: "Beehiiv",
          confidence: "high",
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect Ghost blog on custom domain
 */
async function detectGhostBlog(url: string): Promise<NewsletterFeedResult | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Ghost indicators
    const isGhost =
      /<meta[^>]*name=["']generator["'][^>]*content=["']Ghost/i.test(html) ||
      /ghost\.io|ghost\.org/.test(html);

    if (!isGhost) return null;

    // Ghost RSS patterns
    const feedPatterns = [`${url}/rss/`, `${url}/rss`, `${url}/feed`];

    for (const feedUrl of feedPatterns) {
      const isValid = await verifyFeedUrl(feedUrl);
      if (isValid) {
        return {
          feedUrl,
          platform: "Ghost",
          confidence: "high",
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Generic RSS feed discovery by parsing HTML for feed links
 */
async function discoverGenericFeed(url: string): Promise<NewsletterFeedResult | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Look for RSS feed links in various formats
    const feedSelectors = [
      'link[type="application/rss+xml"]',
      'link[type="application/atom+xml"]',
      'link[type="application/rdf+xml"]',
      'link[rel="alternate"][type*="rss"]',
      'link[rel="alternate"][type*="atom"]',
    ];

    for (const selector of feedSelectors) {
      const link = doc.querySelector(selector) as HTMLLinkElement;
      if (link && link.href) {
        const feedUrl = new URL(link.href, url).toString();
        const isValid = await verifyFeedUrl(feedUrl);
        if (isValid) {
          return {
            feedUrl,
            platform: "RSS/Atom",
            confidence: "medium",
          };
        }
      }
    }

    // Try common WordPress feed URLs as a last resort
    const commonPaths = ["/feed/", "/feed", "/rss/", "/rss"];
    for (const path of commonPaths) {
      const testUrl = `${url}${path}`;
      const isValid = await verifyFeedUrl(testUrl);
      if (isValid) {
        return {
          feedUrl: testUrl,
          platform: "WordPress/RSS",
          confidence: "low",
        };
      }
    }

    return null;
  } catch (error) {
    console.error("[Newsletter Discovery] Generic discovery failed:", error);
    return null;
  }
}

/**
 * Verify that a URL is a valid RSS/Atom feed
 */
async function verifyFeedUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/rss+xml,application/atom+xml,application/xml,text/xml",
      },
    });

    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get("content-type") || "";
    const isXmlContent =
      contentType.includes("xml") || contentType.includes("rss") || contentType.includes("atom");

    const text = await response.text();
    const trimmedText = text.trim().substring(0, 1000);
    const looksLikeXml =
      trimmedText.startsWith("<?xml") ||
      trimmedText.startsWith("<rss") ||
      trimmedText.startsWith("<feed") ||
      trimmedText.startsWith("<rdf:");

    return isXmlContent || looksLikeXml;
  } catch {
    return false;
  }
}

/**
 * Get popular newsletter platforms
 */
export function getNewsletterPlatforms(): string[] {
  return [
    "Substack",
    "Beehiiv",
    "Ghost",
    "Buttondown",
    "ConvertKit",
    "Revue",
    "Medium",
    "WordPress",
  ];
}

/**
 * Quick subscribe to a newsletter URL
 * Combines discovery and subscription in one step
 */
export async function quickSubscribeToNewsletter(
  url: string,
  title?: string
): Promise<Feed | null> {
  try {
    // First, try to discover the feed URL
    const discovery = await discoverNewsletterFeedUrl(url);

    let feedUrl: string;
    if (discovery) {
      feedUrl = discovery.feedUrl;
    } else {
      // If discovery failed, assume the URL is already a feed URL
      feedUrl = url;
    }

    const feed = await fetchFeed(feedUrl);
    if (!feed) {
      throw new Error("Failed to fetch or parse feed");
    }

    // Use provided title or the one from the feed
    if (title) {
      feed.title = title;
    }

    // Subscribe to the feed
    await subscribeToFeedAuto(feed);

    return feed;
  } catch (error) {
    console.error("[Newsletter] Quick subscribe failed:", error);
    throw error;
  }
}

/**
 * Response from full content fetch operation
 */
export interface FullContentResponse {
  articleId: string;
  fullContent?: string;
  excerpt?: string;
  fetchedAt: string;
  success: boolean;
  error?: string;
}

/**
 * CORS proxy URLs for web mode fetching
 */
const CORS_PROXIES = [
  null, // Direct fetch (Tauri bypasses CORS)
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy?quest=",
];

/**
 * Fetch full article content from source URL using Readability extraction
 */
export async function fetchArticleFullContent(
  articleId: string,
  articleUrl: string
): Promise<FullContentResponse> {
  if (isTauri()) {
    // Tauri mode: use backend command
    try {
      const result = await invokeCommand<any>("fetch_article_full_content", {
        articleId,
        article_id: articleId,
        articleUrl,
        article_url: articleUrl,
      });
      return {
        articleId: result.articleId || result.article_id,
        fullContent: result.fullContent || result.full_content,
        excerpt: result.excerpt,
        fetchedAt: result.fetchedAt || result.fetched_at || new Date().toISOString(),
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      console.error("[RSS] Failed to fetch full content via Tauri:", error);
      return {
        articleId,
        success: false,
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  } else {
    // Web mode: fetch via CORS proxies and extract using Mozilla Readability
    return fetchFullContentWeb(articleId, articleUrl);
  }
}

/**
 * Fetch full content in web mode using CORS proxies and Readability
 */
async function fetchFullContentWeb(
  articleId: string,
  articleUrl: string
): Promise<FullContentResponse> {
  // Try CORS proxies in sequence
  for (const proxy of CORS_PROXIES) {
    const fetchUrl = proxy ? `${proxy}${encodeURIComponent(articleUrl)}` : articleUrl;

    try {
      const response = await fetch(fetchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        continue; // Try next proxy
      }

      const html = await response.text();

      // Check content size before processing (limit to 5MB raw HTML)
      if (html.length > 5 * 1024 * 1024) {
        logFetchFailure(articleId, articleUrl, new Error("Content too large (>5MB)"), "fetch");
        continue;
      }

      // Use DOM-based extraction in browser
      const extracted = extractReadableContent(html, articleUrl);

      if (!extracted.content) {
        logFetchFailure(
          articleId,
          articleUrl,
          new Error("Extraction returned empty content"),
          "extraction"
        );
        continue; // Try next proxy if extraction failed
      }

      if (isContentTooLarge(extracted.content)) {
        logFetchFailure(
          articleId,
          articleUrl,
          new Error("Extracted content exceeds 1MB limit"),
          "extraction"
        );
        continue;
      }

      // Generate excerpt
      const excerpt = generateArticleExcerpt(extracted.content);

      const fetchedAt = new Date().toISOString();

      // Store in localStorage for caching
      const cacheKey = `rss_full_content_${articleId}`;
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          content: extracted.content,
          fetchedAt,
          excerpt,
        })
      );

      return {
        articleId,
        fullContent: extracted.content,
        excerpt,
        fetchedAt,
        success: true,
      };
    } catch (error) {
      const stage = error instanceof Error && error.message.includes("CORS") ? "cors" : "fetch";
      logFetchFailure(articleId, articleUrl, error, stage);
      console.warn(`[RSS] Proxy ${proxy || "direct"} failed:`, error);
      continue; // Try next proxy
    }
  }

  return {
    articleId,
    success: false,
    fetchedAt: new Date().toISOString(),
    error: "Failed to fetch article content through all available proxies",
  };
}

/**
 * Extract readable content from HTML using DOM-based approach
 */
function extractReadableContent(html: string, _url: string): { title: string; content: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Simple extraction: try to find main content area
  const selectors = [
    "article",
    "[role='main']",
    "main",
    ".article-content",
    ".post-content",
    ".entry-content",
    ".content",
    "#content",
    ".blog-post",
    ".post",
  ];

  let contentElement: Element | null = null;

  for (const selector of selectors) {
    contentElement = doc.querySelector(selector);
    if (contentElement) break;
  }

  // If no content area found, use body
  if (!contentElement) {
    contentElement = doc.body;
  }

  if (!contentElement) {
    return { title: "", content: "" };
  }

  const clone = contentElement.cloneNode(true) as Element;

  const removeSelectors = [
    "script",
    "style",
    "nav",
    "header",
    "footer",
    "aside",
    ".sidebar",
    ".comments",
    ".advertisement",
    ".ads",
    ".social-share",
    ".related-posts",
    ".author-bio",
    ".newsletter-signup",
    ".cookie-banner",
    ".popup",
    ".modal",
  ];

  removeSelectors.forEach((selector) => {
    const elements = clone.querySelectorAll(selector);
    elements.forEach((el) => el.remove());
  });

  const title =
    doc.querySelector("title")?.textContent || doc.querySelector("h1")?.textContent || "";

  const content = clone.innerHTML;

  return { title, content };
}

/**
 * Generate plain text excerpt from HTML content
 */
export function generateArticleExcerpt(htmlContent: string, maxLength: number = 200): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");

  let text = doc.body.textContent || "";

  text = text.replace(/\s+/g, " ").trim();

  // Truncate at word boundary
  if (text.length > maxLength) {
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 0) {
      text = truncated.substring(0, lastSpace) + "...";
    } else {
      text = truncated + "...";
    }
  }

  return text;
}

/**
 * Get cached full content for an article
 */
export async function getArticleFullContent(
  articleId: string
): Promise<{ content?: string; fetchedAt?: string } | null> {
  if (isTauri()) {
    try {
      const result = await invokeCommand<[string, string] | null>("get_article_full_content", {
        articleId,
        article_id: articleId,
      });
      if (result) {
        return { content: result[0], fetchedAt: result[1] };
      }
      return null;
    } catch (error) {
      console.error("[RSS] Failed to get full content:", error);
      return null;
    }
  } else {
    // Web mode: check localStorage
    const cacheKey = `rss_full_content_${articleId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        return { content: data.content, fetchedAt: data.fetchedAt };
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Update auto-fetch preference for a feed
 */
export async function updateFeedAutoFetchPreference(
  feedId: string,
  autoFetchMode: "always" | "favorites" | "manual"
): Promise<void> {
  if (isTauri()) {
    await invokeCommand("update_feed_auto_fetch", {
      feedId,
      feed_id: feedId,
      autoFetchMode,
      auto_fetch_mode: autoFetchMode,
    });
  } else {
    // Web mode: store in localStorage
    const settingsKey = `rss_feed_settings_${feedId}`;
    const existing = localStorage.getItem(settingsKey);
    const settings = existing ? JSON.parse(existing) : {};
    settings.autoFetchFullContent = autoFetchMode;
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  }
}

/**
 * Check if content is stale (older than 30 days)
 */
export function isContentStale(fetchedAt: string): boolean {
  const fetchDate = new Date(fetchedAt);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return fetchDate < thirtyDaysAgo;
}

/**
 * Clear full content cache for an article
 */
export function clearArticleFullContent(articleId: string): void {
  if (!isTauri()) {
    const cacheKey = `rss_full_content_${articleId}`;
    localStorage.removeItem(cacheKey);
  }
}

const MAX_CONTENT_SIZE = 1024 * 1024; // 1MB per article
const CONTENT_RETENTION_DAYS = 30;

/**
 * Check if content exceeds size limit
 */
export function isContentTooLarge(content: string): boolean {
  const sizeInBytes = new Blob([content]).size;
  return sizeInBytes > MAX_CONTENT_SIZE;
}

/**
 * Prune old cached content from localStorage (web mode only)
 * Removes content older than retention period
 */
export function pruneOldCachedContent(): number {
  if (isTauri()) return 0; // Tauri handles this in backend

  let prunedCount = 0;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - CONTENT_RETENTION_DAYS);

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("rss_full_content_")) continue;

    try {
      const cached = localStorage.getItem(key);
      if (!cached) continue;

      const data = JSON.parse(cached);
      if (data.fetchedAt) {
        const fetchDate = new Date(data.fetchedAt);
        if (fetchDate < cutoffDate) {
          localStorage.removeItem(key);
          prunedCount++;
        }
      }
    } catch {
      // Invalid cache entry, remove it
      localStorage.removeItem(key);
      prunedCount++;
    }
  }

  if (prunedCount > 0) {
  }
  return prunedCount;
}

/**
 * Check if device is currently online
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Log fetch/extraction failures for debugging
 */
export function logFetchFailure(
  articleId: string,
  articleUrl: string,
  error: unknown,
  stage: "fetch" | "extraction" | "cors"
): void {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);

  const failureLog = {
    timestamp,
    articleId,
    articleUrl,
    stage,
    error: errorMessage,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    online: isOnline(),
  };

  // Store in localStorage for debugging (keep last 50 entries)
  const existingLogs = JSON.parse(localStorage.getItem("rss_fetch_failures") || "[]");
  existingLogs.unshift(failureLog);
  const trimmedLogs = existingLogs.slice(0, 50);
  localStorage.setItem("rss_fetch_failures", JSON.stringify(trimmedLogs));

  console.error(`[RSS] Fetch failure at stage "${stage}" for ${articleUrl}:`, errorMessage);
}

/**
 * Get recent fetch failures for debugging
 */
export function getRecentFetchFailures(): Array<{
  timestamp: string;
  articleId: string;
  articleUrl: string;
  stage: string;
  error: string;
  online: boolean;
}> {
  return JSON.parse(localStorage.getItem("rss_fetch_failures") || "[]");
}

/**
 * Clear all fetch failure logs
 */
export function clearFetchFailureLogs(): void {
  localStorage.removeItem("rss_fetch_failures");
}

/**
 * Initialize RSS module - prunes old cache entries on startup
 */
export function initRssModule(): void {
  // Prune old cached content on startup (web mode only)
  pruneOldCachedContent();

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
    });
    window.addEventListener("offline", () => {
    });
  }
}

/**
 * Clean up old RSS articles in Tauri/SQLite database
 */
export async function cleanupOldRssArticlesAuto(days: number): Promise<number> {
  if (isTauri()) {
    try {
      return await invokeCommand<number>("cleanup_old_rss_articles", { days });
    } catch (error) {
      console.warn("[RSS] Failed to clean up old articles via Tauri:", error);
    }
  }
  return 0;
}
