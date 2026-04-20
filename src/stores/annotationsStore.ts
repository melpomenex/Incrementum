/**
 * Annotations Store
 * Manages RSS article annotations (highlights, notes)
 */

import { create } from "zustand";
import {
  type RssAnnotation,
  type CreateAnnotationPayload,
  createAnnotationAuto,
  getArticleAnnotationsAuto,
  updateAnnotationAuto,
  deleteAnnotationAuto,
} from "../api/rss-annotations";

interface AnnotationsState {
  // articleId -> annotations
  annotationsByArticle: Map<string, RssAnnotation[]>;
  isLoading: boolean;
  error: string | null;

  loadAnnotations: (articleId: string) => Promise<void>;
  addHighlight: (
    articleId: string,
    content: string,
    startOffset: number,
    endOffset: number,
    color?: string
  ) => Promise<void>;
  addNote: (articleId: string, content: string) => Promise<void>;
  updateAnnotation: (id: string, updates: Partial<CreateAnnotationPayload>) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
}

export const useAnnotationsStore = create<AnnotationsState>((set, _get) => ({
  annotationsByArticle: new Map(),
  isLoading: false,
  error: null,

  loadAnnotations: async (articleId) => {
    set({ isLoading: true, error: null });
    try {
      const annotations = await getArticleAnnotationsAuto(articleId);
      set((s) => {
        const newMap = new Map(s.annotationsByArticle);
        newMap.set(articleId, annotations);
        return { annotationsByArticle: newMap, isLoading: false };
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  addHighlight: async (articleId, content, startOffset, endOffset, color = "#FFE082") => {
    try {
      const annotation = await createAnnotationAuto({
        article_id: articleId,
        annotation_type: "highlight",
        content,
        start_offset: startOffset,
        end_offset: endOffset,
        color,
      });
      set((s) => {
        const newMap = new Map(s.annotationsByArticle);
        const existing = newMap.get(articleId) || [];
        newMap.set(articleId, [...existing, annotation]);
        return { annotationsByArticle: newMap };
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  addNote: async (articleId, content) => {
    try {
      const annotation = await createAnnotationAuto({
        article_id: articleId,
        annotation_type: "note",
        content,
      });
      set((s) => {
        const newMap = new Map(s.annotationsByArticle);
        const existing = newMap.get(articleId) || [];
        newMap.set(articleId, [...existing, annotation]);
        return { annotationsByArticle: newMap };
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  updateAnnotation: async (id, updates) => {
    try {
      const updated = await updateAnnotationAuto(id, updates);
      set((s) => {
        const newMap = new Map(s.annotationsByArticle);
        for (const [articleId, annotations] of newMap) {
          const idx = annotations.findIndex((a) => a.id === id);
          if (idx >= 0) {
            const newList = [...annotations];
            newList[idx] = updated;
            newMap.set(articleId, newList);
            break;
          }
        }
        return { annotationsByArticle: newMap };
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteAnnotation: async (id) => {
    try {
      await deleteAnnotationAuto(id);
      set((s) => {
        const newMap = new Map(s.annotationsByArticle);
        for (const [articleId, annotations] of newMap) {
          const filtered = annotations.filter((a) => a.id !== id);
          if (filtered.length !== annotations.length) {
            newMap.set(articleId, filtered);
            break;
          }
        }
        return { annotationsByArticle: newMap };
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));
