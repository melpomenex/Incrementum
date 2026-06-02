import { create } from "zustand";

export type VimMode = "inactive" | "normal" | "visual" | "visual-line";

interface VimModeState {
  mode: VimMode;
  cursorIndex: number;
  selectionAnchor: number;
  activeDocId: string | null;
  desiredColumn: number;
  lastAction: string | null;
  pendingSequence: string;

  activate: (docId: string) => void;
  deactivate: () => void;
  setMode: (mode: VimMode) => void;
  moveCursor: (index: number, column?: number) => void;
  setSelectionAnchor: (index: number) => void;
  setLastAction: (action: string) => void;
  setPendingSequence: (seq: string) => void;
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

  activate: (docId) =>
    set({
      mode: "normal",
      cursorIndex: 0,
      selectionAnchor: 0,
      activeDocId: docId,
      desiredColumn: 0,
      lastAction: null,
      pendingSequence: "",
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
    }),

  setMode: (mode) => set({ mode, pendingSequence: "" }),

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

  resetOnContentChange: (docId) =>
    set((state) => {
      if (state.activeDocId !== docId) return state;
      return { cursorIndex: 0, selectionAnchor: 0, desiredColumn: 0, pendingSequence: "" };
    }),
}));
