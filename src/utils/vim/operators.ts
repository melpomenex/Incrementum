/**
 * Vim operator-pending dispatch.
 *
 * Operators (`d`/`c`/`y`) are reading-mode verbs that act on a token range:
 *   - `d{motion|textobject}` → instant extract over the range (no dialog)
 *   - `c{motion|textobject}` → open the extract dialog over the range
 *   - `y{motion|textobject}` → yank the range to the clipboard
 *
 * Documents are read-only in this app, so `d` is "extract (pull out)" rather
 * than "delete text".
 */
import type { VimOperator } from "../../stores/vimModeStore";
import type { VimActionContext } from "./actions";

/**
 * Run the pending operator against a resolved token range.
 *
 * @param operator the verb
 * @param text    the text covered by the range (already stringified)
 * @param ctx     the action context used to perform the underlying action
 */
export async function applyOperator(
  operator: VimOperator,
  text: string,
  ctx: VimActionContext,
): Promise<void> {
  if (!text) return;

  switch (operator) {
    case "d":
      await ctx.createInstantExtract({
        documentId: ctx.documentId,
        text,
        pageNumber: ctx.getPageNumber(),
        selectionContext: ctx.getSelectionContext(),
      });
      ctx.clearTextSelection();
      return;
    case "c":
      ctx.openExtractDialog(text);
      ctx.clearTextSelection();
      return;
    case "y":
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Best-effort fallback for iframe contexts without clipboard permission.
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand("copy");
        } catch {
          // ignore
        }
        textarea.remove();
      }
      ctx.clearTextSelection();
      return;
  }
}
