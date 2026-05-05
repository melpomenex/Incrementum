import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Document } from "../types/document";
import type { StudyDeck } from "../types/study-decks";
import { generateId } from "../utils/id";
import { getDeckTagCandidates, normalizeTagList } from "../utils/studyDecks";

interface StudyDeckState {
  decks: StudyDeck[];
  activeDeckIds: string[];
  toggleDeckSelection: (deckId: string | null) => void;
  clearDeckSelection: () => void;
  addDeck: (name: string, tagFilters?: string[]) => void;
  updateDeck: (deckId: string, updates: Partial<Pick<StudyDeck, "name" | "tagFilters">>) => void;
  removeDeck: (deckId: string) => void;
  seedFromDocuments: (documents: Document[]) => void;
  ensureDecksExist: (deckNames: string[]) => string[];
}

export const useStudyDeckStore = create<StudyDeckState>()(
  persist(
    (set, get) => ({
      decks: [],
      activeDeckIds: [],

      toggleDeckSelection: (deckId) => {
        set((state) => {
          if (deckId === null) return { activeDeckIds: [] };
          const ids = state.activeDeckIds;
          return ids.includes(deckId)
            ? { activeDeckIds: ids.filter((id) => id !== deckId) }
            : { activeDeckIds: [...ids, deckId] };
        });
      },

      clearDeckSelection: () => {
        set({ activeDeckIds: [] });
      },

      addDeck: (name, tagFilters = []) => {
        const trimmed = name.trim() || "Untitled Deck";
        // Dedup: if a deck with the same name already exists, just merge tags
        const existing = get().decks.find((d) => d.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) {
          const mergedTags = normalizeTagList([...existing.tagFilters, ...(tagFilters || [])]);
          get().updateDeck(existing.id, { tagFilters: mergedTags });
          return;
        }
        const now = new Date().toISOString();
        const deck: StudyDeck = {
          id: generateId(),
          name: trimmed,
          tagFilters: normalizeTagList(tagFilters),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ decks: [...state.decks, deck] }));
      },

      updateDeck: (deckId, updates) => {
        set((state) => ({
          decks: state.decks.map((deck) =>
            deck.id === deckId
              ? {
                  ...deck,
                  ...updates,
                  tagFilters: updates.tagFilters
                    ? normalizeTagList(updates.tagFilters)
                    : deck.tagFilters,
                  updatedAt: new Date().toISOString(),
                }
              : deck
          ),
        }));
      },

      removeDeck: (deckId) => {
        set((state) => {
          const nextDecks = state.decks.filter((deck) => deck.id !== deckId);
          const nextActiveIds = state.activeDeckIds.filter((id) => id !== deckId);
          return { decks: nextDecks, activeDeckIds: nextActiveIds };
        });
      },

      ensureDecksExist: (deckNames) => {
        const createdOrMatchedIds: string[] = [];
        for (const deckName of deckNames) {
          const state = get();
          const existing = state.decks.find(
            (deck) => deck.name.trim().toLowerCase() === deckName.trim().toLowerCase()
          );
          if (existing) {
            createdOrMatchedIds.push(existing.id);
            continue;
          }
          get().addDeck(deckName, [deckName]);
          const updatedState = get();
          const created = updatedState.decks.find(
            (deck) => deck.name.trim().toLowerCase() === deckName.trim().toLowerCase()
          );
          if (created) {
            createdOrMatchedIds.push(created.id);
          }
        }
        return createdOrMatchedIds;
      },

      seedFromDocuments: (documents) => {
        const { decks } = get();
        if (decks.length > 0) return;

        const tagCandidates = new Set<string>();
        documents.forEach((doc) => {
          const tags = Array.isArray(doc.tags) ? doc.tags : [];
          if (tags.length === 0) return;
          if (!tags.some((tag) => tag.toLowerCase() === "anki-import" || tag.toLowerCase() === "study-json-import")) return;
          getDeckTagCandidates(tags).forEach((tag) => tagCandidates.add(tag));
        });

        if (tagCandidates.size === 0) return;

        const now = new Date().toISOString();
        const seeded = Array.from(tagCandidates).map((tag) => ({
          id: generateId(),
          name: tag,
          tagFilters: normalizeTagList([tag]),
          createdAt: now,
          updatedAt: now,
        }));

        set({ decks: seeded });
      },
    }),
    {
      name: "incrementum-study-decks",
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          // Migrate activeDeckId (string | null) → activeDeckIds (string[])
          const oldId = state.activeDeckId as string | null | undefined;
          state.activeDeckIds = oldId ? [oldId] : [];
          delete state.activeDeckId;
          delete state.setActiveDeckId;
        }
        return state;
      },
    }
  )
);
