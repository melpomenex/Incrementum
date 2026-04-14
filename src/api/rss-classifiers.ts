/**
 * RSS Intelligence Classifiers API
 * Manages feed intelligence training (like/dislike authors, tags, title keywords)
 */

import { invokeCommand, isTauri } from "../lib/tauri";

// ============================================================================
// Types
// ============================================================================

export interface RssClassifier {
  id: string;
  feed_id: string;
  classifier_type: "author" | "title" | "tag" | "feed";
  value: string;
  sentiment: "like" | "dislike" | "neutral";
  scope: "feed" | "folder" | "global";
  created_at: string;
  updated_at: string;
}

export interface ClassifierUpdate {
  id: string;
  sentiment: string;
  value?: string;
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
// Auto functions (Tauri IPC → HTTP → localStorage fallback)
// ============================================================================

export async function addClassifierAuto(
  feedId: string,
  classifierType: string,
  value: string,
  sentiment: string,
  scope: string = "feed"
): Promise<RssClassifier> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/classifiers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_id: feedId, classifier_type: classifierType, value, sentiment, scope }),
    });
    if (!res.ok) throw new Error(`Failed to add classifier: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssClassifier>("add_rss_classifier", {
    feedId, classifierType, value, sentiment, scope,
  });
}

export async function removeClassifierAuto(id: string): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/classifiers/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to remove classifier: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("remove_rss_classifier", { id });
}

export async function getClassifiersAuto(filters?: {
  feedId?: string;
  folderId?: string;
  classifierType?: string;
  sentiment?: string;
}): Promise<RssClassifier[]> {
  if (shouldUseHttp()) {
    const params = new URLSearchParams();
    if (filters?.feedId) params.set("feed_id", filters.feedId);
    if (filters?.folderId) params.set("folder_id", filters.folderId);
    if (filters?.classifierType) params.set("classifier_type", filters.classifierType);
    if (filters?.sentiment) params.set("sentiment", filters.sentiment);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${getApiBaseUrl()}/api/rss/classifiers${qs}`);
    if (!res.ok) throw new Error(`Failed to get classifiers: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssClassifier[]>("get_rss_classifiers", {
    feedId: filters?.feedId,
    folderId: filters?.folderId,
    classifierType: filters?.classifierType,
    sentiment: filters?.sentiment,
  });
}

export async function updateClassifiersBatchAuto(updates: ClassifierUpdate[]): Promise<number> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/classifiers/batch`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    if (!res.ok) throw new Error(`Failed to update classifiers: ${res.statusText}`);
    const data = await res.json();
    return data.updated;
  }
  return invokeCommand<number>("update_rss_classifiers_batch", { updates });
}

export async function getArticlesWithIntelligenceAuto(
  feedId?: string,
  folderId?: string,
  intelligenceFilter?: string,
  limit?: number,
  offset?: number
): Promise<any[]> {
  if (shouldUseHttp()) {
    const params = new URLSearchParams();
    if (feedId) params.set("feed_id", feedId);
    if (folderId) params.set("folder_id", folderId);
    if (intelligenceFilter) params.set("intelligence_filter", intelligenceFilter);
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${getApiBaseUrl()}/api/rss/articles/intelligence${qs}`);
    if (!res.ok) throw new Error(`Failed to get articles: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<any[]>("get_rss_articles_with_intelligence", {
    feedId, folderId, intelligenceFilter, limit, offset,
  });
}

export async function recomputeIntelligenceScoresAuto(): Promise<number> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/articles/recompute-scores`, { method: "POST" });
    if (!res.ok) throw new Error(`Failed to recompute: ${res.statusText}`);
    const data = await res.json();
    return data.recomputed;
  }
  return invokeCommand<number>("recompute_all_intelligence_scores", {});
}
