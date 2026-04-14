/**
 * RSS Site Discovery API
 * Feed auto-discovery from article links
 */

import { invokeCommand, isTauri } from "../lib/tauri";

// ============================================================================
// Types
// ============================================================================

export interface RssDiscoveredSite {
  id: string;
  url: string;
  title: string;
  description?: string;
  feed_url?: string;
  similarity_source?: string;
  discovered_at: string;
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

export async function getDiscoveredSitesAuto(limit?: number, offset?: number): Promise<RssDiscoveredSite[]> {
  if (shouldUseHttp()) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${getApiBaseUrl()}/api/rss/discover${qs}`);
    if (!res.ok) throw new Error(`Failed to get discoveries: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssDiscoveredSite[]>("get_discovered_sites", { limit, offset });
}

export async function deleteDiscoveredSiteAuto(id: string): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/discover/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete discovery: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("delete_discovered_site", { id });
}

export async function refreshDiscoveriesAuto(): Promise<number> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/discover/refresh`, { method: "POST" });
    if (!res.ok) throw new Error(`Failed to refresh discoveries: ${res.statusText}`);
    const data = await res.json();
    return data.discovered;
  }
  return invokeCommand<number>("refresh_discoveries", {});
}
