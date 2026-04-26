import { create } from "zustand";
import type { GeneratedFlashcard } from "../api/ai";

export interface PendingFlashcardSet {
  id: string;
  extractId: string;
  cards: GeneratedFlashcard[];
  createdAt: number;
  approved: boolean;
  rejected: boolean;
}

interface PendingFlashcardsState {
  pendingSets: PendingFlashcardSet[];
  addCards: (cards: GeneratedFlashcard[], extractId: string) => void;
  approveSet: (id: string) => void;
  rejectSet: (id: string) => void;
  approveCard: (setId: string, cardIndex: number) => void;
  rejectCard: (setId: string, cardIndex: number) => void;
  clearAll: () => void;
}

export const usePendingFlashcardsStore = create<PendingFlashcardsState>()(
  (set) => ({
    pendingSets: [],

    addCards: (cards, extractId) => {
      const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      set((state) => ({
        pendingSets: [
          ...state.pendingSets,
          { id, extractId, cards, createdAt: Date.now(), approved: false, rejected: false },
        ],
      }));
    },

    approveSet: (id) => {
      set((state) => ({
        pendingSets: state.pendingSets.map((s) =>
          s.id === id ? { ...s, approved: true } : s
        ),
      }));
    },

    rejectSet: (id) => {
      set((state) => ({
        pendingSets: state.pendingSets.map((s) =>
          s.id === id ? { ...s, rejected: true } : s
        ),
      }));
    },

    approveCard: (setId, cardIndex) => {
      set((state) => ({
        pendingSets: state.pendingSets.map((s) => {
          if (s.id !== setId) return s;
          const cards = s.cards.map((c, i) =>
            i === cardIndex ? { ...c, approved: true as any } : c
          );
          return { ...s, cards };
        }),
      }));
    },

    rejectCard: (setId, cardIndex) => {
      set((state) => ({
        pendingSets: state.pendingSets.map((s) => {
          if (s.id !== setId) return s;
          const cards = s.cards.map((c, i) =>
            i === cardIndex ? { ...c, rejected: true as any } : c
          );
          return { ...s, cards };
        }),
      }));
    },

    clearAll: () => set({ pendingSets: [] }),
  })
);
