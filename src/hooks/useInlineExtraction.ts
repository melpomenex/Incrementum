
import { useEffect, useCallback, useRef } from "react";
import { useToast } from "../components/common/Toast";
import { useI18n } from "../lib/i18n";

export interface ExtractOptions {
  documentId: string;
  text: string;
  context?: string;
  pageNumber?: number;
  position?: number;
  autoCreateCloze?: boolean;
}

export interface UseInlineExtractionProps {
  documentId: string;
  onExtract?: (options: ExtractOptions) => Promise<void>;
  onCloze?: (options: ExtractOptions) => Promise<void>;
  enabled?: boolean;
}

export function useInlineExtraction({
  documentId,
  onExtract,
  onCloze,
  enabled = true,
}: UseInlineExtractionProps) {
  const toast = useToast();
  const { t } = useI18n();
  const pendingRef = useRef<Set<string>>(new Set());

  const getSelectionInfo = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return null;

    const text = selection.toString().trim();
    if (!text || text.length < 3) return null;

    // Get surrounding context (200 chars before/after)
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const fullText = container.textContent || "";
    
    const startOffset = Math.max(0, range.startOffset - 200);
    const endOffset = Math.min(fullText.length, range.endOffset + 200);
    const context = fullText.slice(startOffset, endOffset);

    return { text, context, range };
  }, []);

  const clearSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
  }, []);

  const flashSelection = useCallback((range: Range) => {
    const selection = window.getSelection();
    if (!selection) return;

    // Flash effect using CSS animation
    const rects = range.getClientRects();
    const flashes: HTMLElement[] = [];

    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      const flash = document.createElement("div");
      flash.className = "absolute pointer-events-none animate-flash-extract";
      flash.style.left = `${rect.left + window.scrollX}px`;
      flash.style.top = `${rect.top + window.scrollY}px`;
      flash.style.width = `${rect.width}px`;
      flash.style.height = `${rect.height}px`;
      flash.style.backgroundColor = "rgba(59, 130, 246, 0.2)";
      flash.style.zIndex = "9999";
      document.body.appendChild(flash);
      flashes.push(flash);
    }

    setTimeout(() => {
      flashes.forEach((f) => f.remove());
    }, 300);
  }, []);

  const handleExtract = useCallback(async () => {
    if (!enabled || !onExtract) return;

    const info = getSelectionInfo();
    if (!info) return;

    const { text, context } = info;
    const extractId = `${documentId}-${text.slice(0, 20)}`;

    if (pendingRef.current.has(extractId)) return;
    pendingRef.current.add(extractId);

    try {
      flashSelection(info.range);

      await onExtract({
        documentId,
        text,
        context,
      });

      // Clear selection and notify user
      clearSelection();
      toast.success(t("viewer.extractCreated"));
    } catch (error) {
      console.error("Extract failed:", error);
      toast.error("Failed to create extract");
    } finally {
      pendingRef.current.delete(extractId);
    }
  }, [documentId, enabled, getSelectionInfo, onExtract, clearSelection, flashSelection, toast]);

  const handleCloze = useCallback(async () => {
    if (!enabled || !onCloze) return;

    const info = getSelectionInfo();
    if (!info) return;

    const { text, context } = info;
    const clozeId = `cloze-${documentId}-${text.slice(0, 20)}`;

    if (pendingRef.current.has(clozeId)) return;
    pendingRef.current.add(clozeId);

    try {
      flashSelection(info.range);

      await onCloze({
        documentId,
        text,
        context,
        autoCreateCloze: true,
      });

      clearSelection();
    } catch (error) {
      console.error("Cloze creation failed:", error);
      toast.error("Failed to create cloze");
    } finally {
      pendingRef.current.delete(clozeId);
    }
  }, [documentId, enabled, getSelectionInfo, onCloze, clearSelection, flashSelection, toast]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+X - Create extract
      if (e.altKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        handleExtract();
      }

      // Alt+Z - Create cloze
      if (e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleCloze();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleExtract, handleCloze]);

  return {
    handleExtract,
    handleCloze,
  };
}

// CSS animation for flash effect
export const flashAnimationStyles = `
  @keyframes flash-extract {
    0% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
  }
  
  .animate-flash-extract {
    animation: flash-extract 0.3s ease-out;
  }
`;
