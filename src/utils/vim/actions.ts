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
    draftCardType: "cloze";
  }) => void;
  clearTextSelection: () => void;
}

export async function doExtract(ctx: VimActionContext): Promise<void> {
  const text = ctx.getSelectedText();
  if (!text) return;

  try {
    await ctx.createInstantExtract({
      documentId: ctx.documentId,
      text,
      pageNumber: ctx.getPageNumber(),
      selectionContext: ctx.getSelectionContext(),
    });
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
    await ctx.createInstantExtract({
      documentId: ctx.documentId,
      text,
      color,
      pageNumber: ctx.getPageNumber(),
      selectionContext: ctx.getSelectionContext(),
    });
  } catch {
    // Highlight creation failed
  }
  ctx.clearTextSelection();
}

export function doFlashcard(ctx: VimActionContext): void {
  const text = ctx.getSelectedText();
  if (!text) return;

  ctx.openFlashcardStudio({
    key: `vim-${ctx.documentId}-${Date.now()}`,
    documentId: ctx.documentId,
    excerpt: text,
    draftCardType: "cloze",
  });
  ctx.clearTextSelection();
}
