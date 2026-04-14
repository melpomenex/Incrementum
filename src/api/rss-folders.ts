/**
 * RSS Folders API
 * Folder management replacing localStorage-based folders
 */

import { invokeCommand, isTauri } from "../lib/tauri";

// ============================================================================
// Types
// ============================================================================

export interface RssFolder {
  id: string;
  name: string;
  parent_id?: string;
  icon?: string;
  sort_order: number;
  auto_mark_after_days?: number;
  created_at: string;
  feed_ids: string[];
}

export interface RssFeedStatistics {
  feed_id: string;
  total_articles: number;
  unread_count: number;
  articles_per_week: number;
  estimated_frequency: string;
  last_fetched?: string;
  date_added: string;
}

function getApiBaseUrl(): string {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? `${window.location.protocol}//${window.location.hostname}:8766`
    : `${window.location.protocol}//${window.location.hostname}`;
}

function shouldUseHttp(): boolean {
  if (isTauri()) return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

// ============================================================================
// Auto functions
// ============================================================================

export async function getFoldersAuto(): Promise<RssFolder[]> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/folders`);
    if (!res.ok) throw new Error(`Failed to get folders: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssFolder[]>("get_rss_folders", {});
}

export async function createFolderAuto(
  name: string,
  parentId?: string,
  icon?: string,
  autoMarkAfterDays?: number
): Promise<RssFolder> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: parentId, icon, auto_mark_after_days: autoMarkAfterDays }),
    });
    if (!res.ok) throw new Error(`Failed to create folder: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssFolder>("create_rss_folder", {
    name, parentId, icon, autoMarkAfterDays,
  });
}

export async function updateFolderAuto(
  id: string,
  updates: { name?: string; parent_id?: string | null; icon?: string; sort_order?: number; auto_mark_after_days?: number | null }
): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/folders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update folder: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("update_rss_folder", { id, ...updates });
}

export async function deleteFolderAuto(id: string, moveFeedsToFolderId?: string): Promise<void> {
  if (shouldUseHttp()) {
    const body: Record<string, string> = {};
    if (moveFeedsToFolderId) body.move_feeds_to_folder_id = moveFeedsToFolderId;
    const res = await fetch(`${getApiBaseUrl()}/api/rss/folders/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to delete folder: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("delete_rss_folder", { id, moveFeedsToFolderId });
}

export async function moveFeedToFolderAuto(
  feedId: string,
  folderId?: string,
  sortOrder?: number
): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/feeds/${feedId}/folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId, sort_order: sortOrder }),
    });
    if (!res.ok) throw new Error(`Failed to move feed: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("move_feed_to_folder", { feedId, folderId, sortOrder });
}

export async function reorderFeedsAuto(reorder: Array<{ feedId: string; sortOrder: number }>, folderId: string): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/feeds/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder, folder_id: folderId }),
    });
    if (!res.ok) throw new Error(`Failed to reorder feeds: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("reorder_feeds", {
    reorder: reorder.map(r => [r.feedId, r.sortOrder] as [string, number]),
    folderId,
  });
}

export async function reorderFoldersAuto(reorder: Array<{ folderId: string; sortOrder: number }>): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/folders/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder: reorder.map(r => [r.folderId, r.sortOrder]) }),
    });
    if (!res.ok) throw new Error(`Failed to reorder folders: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("reorder_folders", {
    reorder: reorder.map(r => [r.folderId, r.sortOrder] as [string, number]),
  });
}

export async function toggleFeedActiveAuto(feedId: string): Promise<boolean> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/feeds/${feedId}/toggle-active`, { method: "POST" });
    if (!res.ok) throw new Error(`Failed to toggle feed: ${res.statusText}`);
    const data = await res.json();
    return data.is_active;
  }
  return invokeCommand<boolean>("toggle_feed_active", { feedId });
}

export async function getFeedStatisticsAuto(feedId: string): Promise<RssFeedStatistics> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/feeds/${feedId}/statistics`);
    if (!res.ok) throw new Error(`Failed to get feed statistics: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssFeedStatistics>("get_feed_statistics", { feedId });
}

export async function setFeedViewPreferencesAuto(
  feedId: string,
  viewMode?: string,
  layout?: string
): Promise<void> {
  if (shouldUseHttp()) {
    const body: Record<string, string> = {};
    if (viewMode) body.view_mode = viewMode;
    if (layout) body.layout = layout;
    const res = await fetch(`${getApiBaseUrl()}/api/rss/feeds/${feedId}/view-prefs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to set view preferences: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("set_feed_view_preferences", { feedId, viewMode, layout });
}

export async function migrateFoldersFromLocalStorageAuto(foldersJson: string): Promise<number> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/folders/migrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folders: JSON.parse(foldersJson) }),
    });
    if (!res.ok) throw new Error(`Failed to migrate folders: ${res.statusText}`);
    const data = await res.json();
    return data.migrated;
  }
  return invokeCommand<number>("migrate_folders_from_localstorage", { foldersJson });
}

// Reading state commands
export async function markArticleUnreadAuto(articleId: string): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/articles/${articleId}/unread`, { method: "POST" });
    if (!res.ok) throw new Error(`Failed to mark unread: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("mark_rss_article_unread", { articleId });
}

export async function markArticlesBeforeDateReadAuto(feedId: string | null, beforeDate: string): Promise<number> {
  if (shouldUseHttp()) {
    const params = new URLSearchParams({ before_date: beforeDate });
    if (feedId) params.set("feed_id", feedId);
    const res = await fetch(`${getApiBaseUrl()}/api/rss/articles/mark-before-date?${params.toString()}`, { method: "POST" });
    if (!res.ok) throw new Error(`Failed to mark before date: ${res.statusText}`);
    const data = await res.json();
    return data.marked;
  }
  return invokeCommand<number>("mark_rss_articles_before_date_read", { feedId, beforeDate });
}

export async function markArticlesAfterDateReadAuto(feedId: string | null, afterDate: string): Promise<number> {
  if (shouldUseHttp()) {
    const params = new URLSearchParams({ after_date: afterDate });
    if (feedId) params.set("feed_id", feedId);
    const res = await fetch(`${getApiBaseUrl()}/api/rss/articles/mark-after-date?${params.toString()}`, { method: "POST" });
    if (!res.ok) throw new Error(`Failed to mark after date: ${res.statusText}`);
    const data = await res.json();
    return data.marked;
  }
  return invokeCommand<number>("mark_rss_articles_after_date_read", { feedId, afterDate });
}

export async function getReadArticlesAuto(limit?: number, offset?: number): Promise<any[]> {
  if (shouldUseHttp()) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${getApiBaseUrl()}/api/rss/articles/read${qs}`);
    if (!res.ok) throw new Error(`Failed to get read articles: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<any[]>("get_read_rss_articles", { limit, offset });
}

export async function getRiverOfNewsAuto(folderId: string, limit?: number): Promise<any[]> {
  if (shouldUseHttp()) {
    const params = new URLSearchParams({ folder_id: folderId });
    if (limit) params.set("limit", String(limit));
    const res = await fetch(`${getApiBaseUrl()}/api/rss/river-of-news?${params.toString()}`);
    if (!res.ok) throw new Error(`Failed to get river of news: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<any[]>("get_river_of_news", { folderId, limit });
}
