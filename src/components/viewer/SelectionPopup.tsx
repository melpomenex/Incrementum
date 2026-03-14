/**
 * SelectionPopup - Floating context menu for PDF text selection.
 *
 * Appears above selected text with options like:
 * - Highlight (with color picker)
 * - Copy
 * - Add Note
 *
 * Position is calculated based on the selection bounding rect.
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Highlighter, Copy, MessageSquarePlus, X } from "lucide-react";

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";

export interface HighlightColors {
  yellow: string;
  green: string;
  blue: string;
  pink: string;
  purple: string;
}

export const HIGHLIGHT_COLORS: HighlightColors = {
  yellow: "rgba(255, 235, 59, 0.5)",
  green: "rgba(76, 175, 80, 0.4)",
  blue: "rgba(33, 150, 243, 0.4)",
  pink: "rgba(233, 30, 99, 0.4)",
  purple: "rgba(156, 39, 176, 0.4)",
};

export interface SelectionPopupProps {
  /** Whether the popup is visible */
  visible: boolean;
  /** Bounding rect of the selection (from getBoundingClientRect) */
  selectionRect: DOMRect | null;
  /** Callback when highlight button is clicked */
  onHighlight?: (color: HighlightColor) => void;
  /** Callback when copy button is clicked */
  onCopy?: () => void;
  /** Callback when add note button is clicked */
  onAddNote?: () => void;
  /** Callback when popup is dismissed */
  onDismiss?: () => void;
  /** Selected text (for display) */
  selectedText?: string;
  /** Maximum width of the popup */
  maxWidth?: number;
}

/**
 * Calculate the optimal position for the popup.
 * Positions the popup centered above the selection.
 */
function calculatePopupPosition(
  selectionRect: DOMRect | null,
  popupWidth: number = 200,
  popupHeight: number = 44
): { top: number; left: number } {
  if (!selectionRect) {
    return { top: 0, left: 0 };
  }

  const gap = 8; // Gap between selection and popup

  // Default: position above selection, centered
  let top = selectionRect.top - popupHeight - gap;
  let left = selectionRect.left + (selectionRect.width - popupWidth) / 2;

  // If popup would go above viewport, position below selection
  if (top < 0) {
    top = selectionRect.bottom + gap;
  }

  // Ensure popup stays within viewport horizontally
  const viewportWidth = window.innerWidth;
  const viewportPadding = 8;

  if (left < viewportPadding) {
    left = viewportPadding;
  } else if (left + popupWidth > viewportWidth - viewportPadding) {
    left = viewportWidth - popupWidth - viewportPadding;
  }

  return { top, left };
}

/**
 * Floating popup component for text selection actions.
 */
export const SelectionPopup: React.FC<SelectionPopupProps> = ({
  visible,
  selectionRect,
  onHighlight,
  onCopy,
  onAddNote,
  onDismiss,
  selectedText,
  maxWidth = 320,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Update position when selection changes
  useEffect(() => {
    if (visible && selectionRect) {
      const popupWidth = popupRef.current?.offsetWidth || 200;
      const popupHeight = popupRef.current?.offsetHeight || 44;
      setPosition(calculatePopupPosition(selectionRect, popupWidth, popupHeight));
    }
  }, [visible, selectionRect]);

  // Reset color picker when popup becomes visible
  useEffect(() => {
    if (visible) {
      setShowColorPicker(false);
    }
  }, [visible]);

  // Handle click outside to dismiss
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onDismiss?.();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss?.();
      }
    };

    // Delay to avoid immediate dismissal from the same click
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [visible, onDismiss]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    if (selectedText) {
      try {
        await navigator.clipboard.writeText(selectedText);
      } catch (err) {
        console.warn("Failed to copy to clipboard:", err);
      }
    }
    onCopy?.();
    onDismiss?.();
  }, [selectedText, onCopy, onDismiss]);

  // Handle highlight with color
  const handleHighlight = useCallback(
    (color: HighlightColor) => {
      onHighlight?.(color);
      setShowColorPicker(false);
      onDismiss?.();
    },
    [onHighlight, onDismiss]
  );

  // Handle add note
  const handleAddNote = useCallback(() => {
    onAddNote?.();
    onDismiss?.();
  }, [onAddNote, onDismiss]);

  if (!visible || !selectionRect) {
    return null;
  }

  return (
    <div
      ref={popupRef}
      className="selection-popup"
      style={{
        top: position.top,
        left: position.left,
        maxWidth,
      }}
      role="toolbar"
      aria-label="Text selection actions"
    >
      {/* Highlight button with color picker */}
      <button
        className="selection-popup-button"
        onClick={() => setShowColorPicker(!showColorPicker)}
        title="Highlight"
      >
        <Highlighter className="w-4 h-4" />
        <span className="hidden sm:inline">Highlight</span>
      </button>

      {/* Color picker dropdown */}
      {showColorPicker && (
        <div className="selection-popup-color-picker">
          <button
            className="color-dot yellow"
            onClick={() => handleHighlight("yellow")}
            title="Yellow highlight"
            aria-label="Yellow highlight"
          />
          <button
            className="color-dot green"
            onClick={() => handleHighlight("green")}
            title="Green highlight"
            aria-label="Green highlight"
          />
          <button
            className="color-dot blue"
            onClick={() => handleHighlight("blue")}
            title="Blue highlight"
            aria-label="Blue highlight"
          />
          <button
            className="color-dot pink"
            onClick={() => handleHighlight("pink")}
            title="Pink highlight"
            aria-label="Pink highlight"
          />
          <button
            className="color-dot purple"
            onClick={() => handleHighlight("purple")}
            title="Purple highlight"
            aria-label="Purple highlight"
          />
        </div>
      )}

      {!showColorPicker && <div className="selection-popup-divider" />}

      {/* Copy button */}
      {!showColorPicker && (
        <button
          className="selection-popup-button"
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          <Copy className="w-4 h-4" />
          <span className="hidden sm:inline">Copy</span>
        </button>
      )}

      {/* Add Note button */}
      {!showColorPicker && (
        <button
          className="selection-popup-button"
          onClick={handleAddNote}
          title="Add note"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span className="hidden sm:inline">Note</span>
        </button>
      )}
    </div>
  );
};

export default SelectionPopup;
