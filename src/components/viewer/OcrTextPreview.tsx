import { RotateCcw, FileText, X } from "lucide-react";
import type { SelectionRect } from "./OcrRegionSelector";

// Inlined language constants to avoid build-time tesseract.js dependency
const AVAILABLE_LANGUAGES = [
  { code: "eng", name: "English" },
  { code: "spa", name: "Spanish" },
  { code: "fra", name: "French" },
  { code: "deu", name: "German" },
  { code: "ita", name: "Italian" },
  { code: "por", name: "Portuguese" },
  { code: "rus", name: "Russian" },
  { code: "chi_sim", name: "Chinese (Simplified)" },
  { code: "chi_tra", name: "Chinese (Traditional)" },
  { code: "jpn", name: "Japanese" },
  { code: "kor", name: "Korean" },
  { code: "ara", name: "Arabic" },
  { code: "hin", name: "Hindi" },
  { code: "nld", name: "Dutch" },
  { code: "pol", name: "Polish" },
  { code: "tur", name: "Turkish" },
  { code: "vie", name: "Vietnamese" },
  { code: "tha", name: "Thai" },
  { code: "heb", name: "Hebrew" },
] as const;

interface OCRResult {
  text: string;
  confidence: number;
}

interface OcrTextPreviewProps {
  ocrResult: OCRResult | null;
  editedText: string;
  language: string;
  isLoading: boolean;
  error: string | null;
  selectionRect: SelectionRect;
  cssScale: number;
  canvasRect?: DOMRect | null;
  onTextChange: (text: string) => void;
  onLanguageChange: (language: string) => void;
  onCreateExtract: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

export function OcrTextPreview({
  ocrResult,
  editedText,
  language,
  isLoading,
  error,
  selectionRect,
  cssScale,
  canvasRect,
  onTextChange,
  onLanguageChange,
  onCreateExtract,
  onRetry,
  onCancel,
}: OcrTextPreviewProps) {
  const confidenceColor =
    ocrResult && ocrResult.confidence >= 80
      ? "text-green-600"
      : ocrResult && ocrResult.confidence >= 60
        ? "text-yellow-600"
        : "text-red-600";

  let style: React.CSSProperties = {
    position: "absolute",
    left: Math.min(selectionRect.x * cssScale, window.innerWidth - 420),
    top: selectionRect.y * cssScale + selectionRect.height * cssScale + 52,
    width: 400,
    maxHeight: Math.min(500, Math.max(150, window.innerHeight - (selectionRect.y * cssScale + selectionRect.height * cssScale + 80))),
    zIndex: 30,
  };

  if (canvasRect) {
    const gap = 12;
    const popupWidth = 400;
    const popupHeight = 420;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Viewport-relative coordinates of the selection region
    const selLeft = canvasRect.left + selectionRect.x * cssScale;
    const selTop = canvasRect.top + selectionRect.y * cssScale;
    const selWidth = selectionRect.width * cssScale;
    const selHeight = selectionRect.height * cssScale;

    // Default position: centered below the selection
    let top = selTop + selHeight + gap;
    let left = selLeft + (selWidth - popupWidth) / 2;

    // Flip above the selection if it overflows off the bottom of the viewport
    if (top + popupHeight > viewportHeight - 16) {
      top = selTop - popupHeight - gap;
    }

    // Ensure within viewport boundaries vertically
    if (top < 16) {
      // If it doesn't fit above or below, center it vertically in the viewport
      top = Math.max(16, (viewportHeight - popupHeight) / 2);
    }

    // Ensure within viewport boundaries horizontally
    left = Math.max(16, Math.min(viewportWidth - popupWidth - 16, left));

    style = {
      position: "fixed",
      left,
      top,
      width: popupWidth,
      maxHeight: Math.min(500, viewportHeight - top - 32),
      zIndex: 1000, // Float on top of other layout panels
    };
  }

  return (
    <div
      className="bg-background border border-border rounded-lg shadow-xl flex flex-col transition-all"
      style={style}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">OCR Result</span>
          {ocrResult && (
            <span className={`text-xs font-medium ${confidenceColor}`}>
              {Math.round(ocrResult.confidence)}% confidence
            </span>
          )}
        </div>
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-border">
          {error.split("\n").map((line, i) => (
            <p key={i} className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
              {line}
            </p>
          ))}
        </div>
      )}

      {/* Language selector */}
      <div className="px-3 py-1.5 border-b border-border">
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          disabled={isLoading}
          className="w-full text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {AVAILABLE_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* Editable text area */}
      <div className="flex-1 min-h-0 p-3">
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
            Running OCR...
          </div>
        ) : (
          <textarea
            value={editedText}
            onChange={(e) => onTextChange(e.target.value)}
            className="w-full h-40 resize-y text-sm bg-muted/50 border border-border rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono leading-relaxed"
            placeholder="OCR text will appear here..."
            aria-label="OCR text preview"
            autoFocus
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/30 rounded-b-lg">
        <button
          onClick={onCreateExtract}
          disabled={!editedText.trim() || isLoading}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Create Extract
        </button>
        <button
          onClick={onRetry}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md disabled:opacity-50 transition-colors"
          title="Re-run OCR with selected language"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Retry
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Close
        </button>
      </div>
    </div>
  );
}
