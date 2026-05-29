/**
 * RSS Story Clustering API
 * Duplicate and related story detection
 */

import { invokeCommand, isTauri } from "../lib/tauri";

export interface RssStoryCluster {
  id: string;
  canonical_article_id: string;
  article_id: string;
  similarity_score: number;
  cluster_type: "duplicate" | "related";
  created_at: string;
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

export async function getArticleClustersAuto(
  feedId?: string,
  folderId?: string,
  clusterType?: string
): Promise<RssStoryCluster[]> {
  if (shouldUseHttp()) {
    const params = new URLSearchParams();
    if (feedId) params.set("feed_id", feedId);
    if (folderId) params.set("folder_id", folderId);
    if (clusterType) params.set("cluster_type", clusterType);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${getApiBaseUrl()}/api/rss/clusters${qs}`);
    if (!res.ok) throw new Error(`Failed to get clusters: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssStoryCluster[]>("get_rss_article_clusters", {
    feedId, folderId, clusterType,
  });
}

export async function computeStoryClustersAuto(feedId: string): Promise<number> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/clusters/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_id: feedId }),
    });
    if (!res.ok) throw new Error(`Failed to compute clusters: ${res.statusText}`);
    const data = await res.json();
    return data.computed;
  }
  return invokeCommand<number>("compute_story_clusters", { feedId });
}

export async function invalidateClustersForFeedAuto(feedId: string): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/clusters/${feedId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to invalidate clusters: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("invalidate_clusters_for_feed", { feedId });
}
