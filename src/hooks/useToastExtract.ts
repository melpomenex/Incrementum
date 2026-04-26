/**
 * useToastExtract - Instant extract creation with toast feedback.
 *
 * Creates an extract immediately (no dialog), flashes the selection,
 * and shows a success toast with an "Edit" action button.
 */

import { useCallback, useRef } from "react";
import { createExtract, CreateExtractInput, Extract } from "../api/extracts";
import { useToast } from "../components/common/Toast";
import { useExtractStore } from "../stores/extractStore";

interface UseToastExtractOptions {
  onEditExtract?: (extract: Extract) => void;
}

export function useToastExtract(options?: UseToastExtractOptions) {
  const toast = useToast();
  const { lastHighlightColor, setLastHighlightColor, loadExtracts } = useExtractStore();
  const pendingRef = useRef<Set<string>>(new Set());

  const createInstantExtract = useCallback(
    async (params: {
      documentId: string;
      text: string;
      color?: string;
      pageNumber?: number;
      selectionContext?: unknown;
      note?: string;
    }): Promise<Extract | null> => {
      const { documentId, text, color, pageNumber, selectionContext, note } = params;

      if (!text.trim() || text.trim().length < 3) return null;

      const dedupeKey = `${documentId}-${text.slice(0, 20)}`;
      if (pendingRef.current.has(dedupeKey)) return null;
      pendingRef.current.add(dedupeKey);

      const extractColor = color || lastHighlightColor;

      try {
        const input: CreateExtractInput = {
          document_id: documentId,
          content: text.trim(),
          color: extractColor,
          page_number: pageNumber,
          selection_context: selectionContext as CreateExtractInput["selection_context"],
          note: note,
        };

        const extract = await createExtract(input);
        setLastHighlightColor(extractColor);
        loadExtracts(documentId);

        toast.success("Highlight saved", undefined, {
          action: {
            label: "Edit",
            onClick: () => options?.onEditExtract?.(extract),
          },
        });

        return extract;
      } catch (error) {
        console.error("Failed to create extract:", error);
        toast.error("Failed to create highlight", error instanceof Error ? error.message : undefined);
        return null;
      } finally {
        pendingRef.current.delete(dedupeKey);
      }
    },
    [lastHighlightColor, setLastHighlightColor, loadExtracts, toast, options]
  );

  return { createInstantExtract };
}
