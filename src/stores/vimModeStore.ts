import { create } from "zustand";

export type VimMode = "inactive" | "normal" | "visual" | "visual-line";

/** Operator-pending verb awaiting a motion or text object. */
export type VimOperator = "d" | "c" | "y";

/** Default DraftCardType seeded by vim flashcard entry points. */
export type VimCardType = "qa" | "cloze" | "multiple-choice";

const LAST_EXTRACT_TTL_MS = 60_000;
const NEXT_DECK_TAG_TTL_MS = 60_000;
const CARD_TYPE_STORAGE_KEY = "vim-default-card-type";

function readPersistedCardType(): VimCardType {
  try {
    const v = localStorage.getItem(CARD_TYPE_STORAGE_KEY);
    if (v === "qa" || v === "cloze" || v === "multiple-choice") return v;
  } catch {
    // localStorage unavailable (private mode, test env, etc.)
  }
  return "qa";
}

function writePersistedCardType(v: VimCardType): void {
  try {
    localStorage.setItem(CARD_TYPE_STORAGE_KEY, v);
  } catch {
    // ignore write failures
  }
}

interface VimModeState {
  mode: VimMode;
  cursorIndex: number;
  selectionAnchor: number;
  activeDocId: string | null;
  desiredColumn: number;
  lastAction: string | null;
  pendingSequence: string;

  /** Operator-pending verb (d/c/y) awaiting a motion or text object. */
  pendingOperator: VimOperator | null;
  /** The most recent instant extract id, used by the `gf` chain action. */
  lastExtractId: string | null;
  lastExtractAt: number | null;
  /** Transient deck tag applied to the next vim-created flashcard. */
  nextDeckTag: string | null;
  nextDeckTagAt: number | null;
  /** Default card type for vim flashcard entry points (persisted). */
  defaultVimCardType: VimCardType;

  activate: (docId: string) => void;
  deactivate: () => void;
  setMode: (mode: VimMode) => void;
  moveCursor: (index: number, column?: number) => void;
  setSelectionAnchor: (index: number) => void;
  setLastAction: (action: string) => void;
  setPendingSequence: (seq: string) => void;
  setPendingOperator: (op: VimOperator | null) => void;
  setLastExtractId: (id: string | null) => void;
  /** Read+clear the next deck tag if it is still valid; returns null if expired. */
  consumeNextDeckTag: () => string | null;
  setNextDeckTag: (tag: string) => void;
  setDefaultVimCardType: (cardType: VimCardType) => void;
  /** Clear transient capture-related state (called on tab switch / blur). */
  clearTransient: () => void;
  resetOnContentChange: (docId: string) => void;
}

export const useVimModeStore = create<VimModeState>((set) => ({
  mode: "inactive",
  cursorIndex: 0,
  selectionAnchor: 0,
  activeDocId: null,
  desiredColumn: 0,
  lastAction: null,
  pendingSequence: "",
  pendingOperator: null,
  lastExtractId: null,
  lastExtractAt: null,
  nextDeckTag: null,
  nextDeckTagAt: null,
  defaultVimCardType: readPersistedCardType(),

  activate: (docId) =>
    set({
      mode: "normal",
      cursorIndex: 0,
      selectionAnchor: 0,
      activeDocId: docId,
      desiredColumn: 0,
      lastAction: null,
      pendingSequence: "",
      pendingOperator: null,
    }),

  deactivate: () =>
    set({
      mode: "inactive",
      cursorIndex: 0,
      selectionAnchor: 0,
      activeDocId: null,
      desiredColumn: 0,
      lastAction: null,
      pendingSequence: "",
      pendingOperator: null,
    }),

  setMode: (mode) => set({ mode, pendingSequence: "", pendingOperator: null }),

  moveCursor: (index, column) =>
    set((state) => ({
      cursorIndex: index,
      ...(column !== undefined ? { desiredColumn: column } : {}),
      ...(state.mode === "visual" || state.mode === "visual-line"
        ? {}
        : { selectionAnchor: index }),
    })),

  setSelectionAnchor: (index) => set({ selectionAnchor: index }),

  setLastAction: (action) => set({ lastAction: action }),

  setPendingSequence: (seq) => set({ pendingSequence: seq }),

  setPendingOperator: (op) =>
    set({ pendingOperator: op, pendingSequence: "" }),

  setLastExtractId: (id) =>
    set({ lastExtractId: id, lastExtractAt: id ? Date.now() : null }),

  setNextDeckTag: (tag) =>
    set({ nextDeckTag: tag, nextDeckTagAt: Date.now() }),

  consumeNextDeckTag: () => {
    const state = useVimModeStore.getState();
    const { nextDeckTag, nextDeckTagAt } = state;
    if (!nextDeckTag || !nextDeckTagAt) return null;
    if (Date.now() - nextDeckTagAt > NEXT_DECK_TAG_TTL_MS) {
      set({ nextDeckTag: null, nextDeckTagAt: null });
      return null;
    }
    set({ nextDeckTag: null, nextDeckTagAt: null });
    return nextDeckTag;
  },

  setDefaultVimCardType: (cardType) => {
    writePersistedCardType(cardType);
    set({ defaultVimCardType: cardType });
  },

  clearTransient: () =>
    set({
      pendingSequence: "",
      pendingOperator: null,
      lastExtractId: null,
      lastExtractAt: null,
      nextDeckTag: null,
      nextDeckTagAt: null,
    }),

  resetOnContentChange: (docId) =>
    set((state) => {
      if (state.activeDocId !== docId) return state;
      return {
        cursorIndex: 0,
        selectionAnchor: 0,
        desiredColumn: 0,
        pendingSequence: "",
        pendingOperator: null,
      };
    }),
}));

/** Read lastExtractId if still valid (within TTL), else null. */
export function readLastExtractId(state: VimModeState): string | null {
  if (!state.lastExtractId || !state.lastExtractAt) return null;
  if (Date.now() - state.lastExtractAt > LAST_EXTRACT_TTL_MS) return null;
  return state.lastExtractId;
}
