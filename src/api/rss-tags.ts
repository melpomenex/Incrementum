/**
 * RSS Tags API
 * Manages saved story tags for categorizing articles
 */

import { invokeCommand, isTauri } from "../lib/tauri";

export interface RssTag {
  id: string;
  name: string;
  created_at: string;
  article_count?: number;
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

export async function getAllTagsAuto(): Promise<RssTag[]> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/tags`);
    if (!res.ok) throw new Error(`Failed to get tags: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssTag[]>("get_all_tags", {});
}

export async function getArticleTagsAuto(articleId: string): Promise<RssTag[]> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/articles/${articleId}/tags`);
    if (!res.ok) throw new Error(`Failed to get article tags: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssTag[]>("get_article_tags", { articleId });
}

export async function tagArticleAuto(articleId: string, tagId: string): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/articles/${articleId}/tags/${tagId}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Failed to tag article: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("tag_article", { articleId, tagId });
}

export async function untagArticleAuto(articleId: string, tagId: string): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/articles/${articleId}/tags/${tagId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Failed to untag article: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("untag_article", { articleId, tagId });
}

export async function getArticlesByTagAuto(tagId: string, limit?: number, offset?: number): Promise<any[]> {
  if (shouldUseHttp()) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${getApiBaseUrl()}/api/rss/tags/${tagId}/articles${qs}`);
    if (!res.ok) throw new Error(`Failed to get articles by tag: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<any[]>("get_articles_by_tag", { tagId, limit, offset });
}

export async function renameTagAuto(tagId: string, newName: string): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/tags/${tagId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (!res.ok) throw new Error(`Failed to rename tag: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("rename_tag", { tagId, newName });
}

export async function mergeTagsAuto(sourceTagId: string, targetTagId: string): Promise<number> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/tags/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_tag_id: sourceTagId, target_tag_id: targetTagId }),
    });
    if (!res.ok) throw new Error(`Failed to merge tags: ${res.statusText}`);
    const data = await res.json();
    return data.merged;
  }
  return invokeCommand<number>("merge_tags", { sourceTagId, targetTagId });
}

export async function createTagAuto(name: string): Promise<RssTag> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Failed to create tag: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssTag>("add_tag", { name });
}

export async function deleteTagAuto(id: string): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/tags/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete tag: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("remove_tag", { id });
}
