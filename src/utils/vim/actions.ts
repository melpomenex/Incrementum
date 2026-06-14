export interface VimActionContext {
  documentId: string;
  getSelectedText: () => string;
  getPageNumber: () => number;
  getSelectionContext: () => unknown;
  createInstantExtract: (params: {
    documentId: string;
    text: string;
    color?: string;
    pageNumber?: number;
    selectionContext?: unknown;
  }) => Promise<unknown>;
  openExtractDialog: (text: string) => void;
  openFlashcardStudio: (params: {
    key: string;
    documentId: string;
    excerpt: string;
    draftCardType: "qa" | "cloze" | "multiple-choice";
  }) => void;
  /** Open Flashcard Studio seeded from an existing extract (chain action). */
  openFlashcardStudioForExtract?: (params: {
    key: string;
    documentId: string;
    extractId: string;
    deckTag?: string | null;
  }) => void;
  /** Set the most recent extract id (for the `gf` chain). */
  setLastExtractId?: (id: string | null) => void;
  clearTextSelection: () => void;
}

export async function doExtract(ctx: VimActionContext): Promise<void> {
  const text = ctx.getSelectedText();
  if (!text) return;

  try {
    const result = await ctx.createInstantExtract({
      documentId: ctx.documentId,
      text,
      pageNumber: ctx.getPageNumber(),
      selectionContext: ctx.getSelectionContext(),
    });
    // Record the extract id so `gf` can chain from it. The API returns the
    // created Extract (or null on dedupe/failure).
    const id = (result as { id?: string } | null)?.id;
    if (id && ctx.setLastExtractId) ctx.setLastExtractId(id);
  } catch {
    // Extract creation failed, but we still clear selection
  }
  ctx.clearTextSelection();
}

export function doExtractWithDialog(ctx: VimActionContext): void {
  const text = ctx.getSelectedText();
  if (!text) return;

  ctx.openExtractDialog(text);
  ctx.clearTextSelection();
}

export async function doYank(ctx: VimActionContext): Promise<void> {
  const text = ctx.getSelectedText();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for iframe contexts
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
    } catch {
      // execCommand may not be available
    }
    textarea.remove();
  }
  // Always clear selection, even if clipboard write failed
  ctx.clearTextSelection();
}

export async function doHighlight(ctx: VimActionContext, color: string = "yellow"): Promise<void> {
  const text = ctx.getSelectedText();
  if (!text) return;

  try {
    const result = await ctx.createInstantExtract({
      documentId: ctx.documentId,
      text,
      color,
      pageNumber: ctx.getPageNumber(),
      selectionContext: ctx.getSelectionContext(),
    });
    const id = (result as { id?: string } | null)?.id;
    if (id && ctx.setLastExtractId) ctx.setLastExtractId(id);
  } catch {
    // Highlight creation failed
  }
  ctx.clearTextSelection();
}

/**
 * Open Flashcard Studio seeded with the current selection. The card type is
 * read from the user's configured `defaultVimCardType` preference unless an
 * explicit type is passed (e.g. from the `:cloze` / `:qa` commands).
 */
export function doFlashcard(
  ctx: VimActionContext,
  opts?: { draftCardType?: "qa" | "cloze" | "multiple-choice"; deckTag?: string | null },
): void {
  const text = ctx.getSelectedText();
  if (!text) return;

  const draftCardType = opts?.draftCardType ?? "qa";
  ctx.openFlashcardStudio({
    key: `vim-${ctx.documentId}-${Date.now()}`,
    documentId: ctx.documentId,
    excerpt: text,
    draftCardType,
  });
  ctx.clearTextSelection();
}

/**
 * Open Flashcard Studio seeded from an existing extract (the `gf` chain action).
 */
export function doChainFlashcard(ctx: VimActionContext, extractId: string, deckTag?: string | null): void {
  if (!ctx.openFlashcardStudioForExtract) return;
  ctx.openFlashcardStudioForExtract({
    key: `vim-chain-${ctx.documentId}-${Date.now()}`,
    documentId: ctx.documentId,
    extractId,
    deckTag: deckTag ?? null,
  });
}
