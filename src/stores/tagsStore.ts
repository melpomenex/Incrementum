/**
 * Tags Store
 * Manages RSS article tags state
 */

import { create } from "zustand";
import {
  type RssTag,
  getAllTagsAuto,
  getArticleTagsAuto,
  tagArticleAuto,
  untagArticleAuto,
  createTagAuto,
  deleteTagAuto,
  renameTagAuto,
  mergeTagsAuto,
} from "../api/rss-tags";

interface TagsState {
  tags: RssTag[];
  // articleId -> tagIds for currently viewed article
  articleTags: Map<string, RssTag[]>;
  isLoading: boolean;
  error: string | null;

  // Filter state
  selectedTagFilter: string | null;

  loadTags: () => Promise<void>;
  loadArticleTags: (articleId: string) => Promise<void>;
  createAndTag: (articleId: string, name: string) => Promise<RssTag>;
  tagArticle: (articleId: string, tagId: string) => Promise<void>;
  untagArticle: (articleId: string, tagId: string) => Promise<void>;
  renameTag: (tagId: string, newName: string) => Promise<void>;
  mergeTags: (sourceId: string, targetId: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  setTagFilter: (tagId: string | null) => void;
}

export const useTagsStore = create<TagsState>((set, get) => ({
  tags: [],
  articleTags: new Map(),
  isLoading: false,
  error: null,
  selectedTagFilter: null,

  loadTags: async () => {
    set({ isLoading: true, error: null });
    try {
      const tags = await getAllTagsAuto();
      set({ tags, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  loadArticleTags: async (articleId) => {
    try {
      const articleTags = await getArticleTagsAuto(articleId);
      set((s) => {
        const newMap = new Map(s.articleTags);
        newMap.set(articleId, articleTags);
        return { articleTags: newMap };
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  createAndTag: async (articleId, name) => {
    try {
      const tag = await createTagAuto(name);
      await tagArticleAuto(articleId, tag.id);
      set((s) => {
        const newTags = s.tags.find((t) => t.id === tag.id) ? s.tags : [...s.tags, tag];
        const newMap = new Map(s.articleTags);
        const existing = newMap.get(articleId) || [];
        newMap.set(articleId, [...existing, tag]);
        return { tags: newTags, articleTags: newMap };
      });
      return tag;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  tagArticle: async (articleId, tagId) => {
    try {
      await tagArticleAuto(articleId, tagId);
      const tag = get().tags.find((t) => t.id === tagId);
      if (tag) {
        set((s) => {
          const newMap = new Map(s.articleTags);
          const existing = newMap.get(articleId) || [];
          if (!existing.find((t) => t.id === tagId)) {
            newMap.set(articleId, [...existing, tag]);
          }
          return { articleTags: newMap };
        });
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  untagArticle: async (articleId, tagId) => {
    try {
      await untagArticleAuto(articleId, tagId);
      set((s) => {
        const newMap = new Map(s.articleTags);
        const existing = newMap.get(articleId) || [];
        newMap.set(articleId, existing.filter((t) => t.id !== tagId));
        return { articleTags: newMap };
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  renameTag: async (tagId, newName) => {
    try {
      await renameTagAuto(tagId, newName);
      set((s) => ({
        tags: s.tags.map((t) => (t.id === tagId ? { ...t, name: newName } : t)),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  mergeTags: async (sourceId, targetId) => {
    try {
      await mergeTagsAuto(sourceId, targetId);
      set((s) => ({
        tags: s.tags.filter((t) => t.id !== sourceId).map((t) =>
          t.id === targetId ? { ...t, article_count: (t.article_count || 0) + 1 } : t
        ),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteTag: async (id) => {
    try {
      await deleteTagAuto(id);
      set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setTagFilter: (tagId) => set({ selectedTagFilter: tagId }),
}));
