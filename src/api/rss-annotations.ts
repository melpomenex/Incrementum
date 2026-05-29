/**
 * RSS Annotations API
 * Highlights and notes on articles
 */

import { invokeCommand, isTauri } from "../lib/tauri";

export interface RssAnnotation {
  id: string;
  article_id: string;
  annotation_type: "highlight" | "note" | "share";
  content: string;
  start_offset?: number;
  end_offset?: number;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnotationPayload {
  article_id: string;
  annotation_type: string;
  content: string;
  start_offset?: number;
  end_offset?: number;
  color?: string;
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

export async function createAnnotationAuto(payload: CreateAnnotationPayload): Promise<RssAnnotation> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create annotation: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssAnnotation>("create_annotation", {
    articleId: payload.article_id,
    annotationType: payload.annotation_type,
    content: payload.content,
    startOffset: payload.start_offset,
    endOffset: payload.end_offset,
    color: payload.color,
  });
}

export async function getArticleAnnotationsAuto(articleId: string): Promise<RssAnnotation[]> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/articles/${articleId}/annotations`);
    if (!res.ok) throw new Error(`Failed to get annotations: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssAnnotation[]>("get_article_annotations", { articleId });
}

export async function updateAnnotationAuto(id: string, updates: Partial<CreateAnnotationPayload>): Promise<RssAnnotation> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/annotations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update annotation: ${res.statusText}`);
    return res.json();
  }
  return invokeCommand<RssAnnotation>("update_annotation", { id, updates });
}

export async function deleteAnnotationAuto(id: string): Promise<void> {
  if (shouldUseHttp()) {
    const res = await fetch(`${getApiBaseUrl()}/api/rss/annotations/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete annotation: ${res.statusText}`);
    return;
  }
  return invokeCommand<void>("delete_annotation", { id });
}
