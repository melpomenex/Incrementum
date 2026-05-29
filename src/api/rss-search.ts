/**
 * RSS Full-Text Search API
 * FTS5-powered article search with ranking and snippet highlighting
 */

import { invokeCommand, isTauri } from "../lib/tauri";

export interface RssSearchResult {
  id: string;
  feed_id: string;
  title: string;
  author?: string;
  published_date?: string;
  snippet: string;
  rank: number;
  feed_title?: string;
}

export interface RssSearchParams {
  query: string;
  feed_id?: string;
  folder_id?: string;
  limit?: number;
  offset?: number;
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

export async function searchArticlesAuto(params: RssSearchParams): Promise<RssSearchResult[]> {
  if (shouldUseHttp()) {
    const qs = new URLSearchParams({ query: params.query });
    if (params.feed_id) qs.set("feed_id", params.feed_id);
    if (params.folder_id) qs.set("folder_id", params.folder_id);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    const res = await fetch(`${getApiBaseUrl()}/api/rss/search?${qs.toString()}`);
    if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssSearchResult[]>("search_rss_articles", {
    query: params.query,
    feedId: params.feed_id,
    folderId: params.folder_id,
    limit: params.limit,
    offset: params.offset,
  });
}
