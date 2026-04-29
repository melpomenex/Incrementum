import { useState, useCallback, useRef } from "react";
import { isTauri } from "../../lib/tauri";
import { ocrImageBytes, type OCRResponse } from "../../api/ocrCommands";
import { captureCanvasRegion } from "./ocrCanvasCapture";
import { ensureOCRConfig } from "../../utils/documentAutoExtract";
import { useSettingsStore } from "../../stores/settingsStore";
import type { SelectionRect } from "./OcrRegionSelector";

export type OcrFlowState = "idle" | "selecting" | "processing" | "previewing" | "error";

interface OCRResult {
  text: string;
  confidence: number;
}

interface OcrManagerState {
  flowState: OcrFlowState;
  selectedRect: SelectionRect | null;
  ocrResult: OCRResult | null;
  editedText: string;
  language: string;
  error: string | null;
  /** Base64 image data stored for retry */
  lastImageData: string | null;
}

const DEFAULT_LANGUAGE = "eng";

function cleanOCRText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\|/g, "I")
    .replace(/([a-z])\1\1+/g, "$1$1")
    .trim();
}

/** Extract base64 payload from a data URL */
function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

/** Run OCR via the Tauri backend (native Tesseract, no web worker issues) */
async function runOcrBackend(base64Data: string, language: string): Promise<OCRResult> {
  const response: OCRResponse = await ocrImageBytes({
    image_data: base64Data,
    language,
  });

  if (!response.success) {
    throw new Error(response.error ?? "OCR backend returned failure");
  }

  return {
    text: cleanOCRText(response.text),
    confidence: response.confidence,
  };
}

/** Run OCR via Tesseract.js in-browser (fallback for PWA mode) */
async function runOcrBrowser(dataUrl: string, language: string): Promise<OCRResult> {
  // Load Tesseract.js from CDN to bypass Vite's pre-bundling entirely.
  // The pre-bundled version transforms the Worker spawn path in ways that
  // break postMessage (DataCloneError: functions become non-cloneable
  // after esbuild processes the CJS module).  Using the UMD CDN build
  // avoids this entirely.
  const win = window as any;
  if (!win.__tesseractLoaded) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Tesseract.js from CDN'));
      document.head.appendChild(script);
    });
    win.__tesseractLoaded = true;
  }

  const Tesseract = win.Tesseract;
  const worker = await Tesseract.createWorker(language);

  try {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });

    const result = await worker.recognize(blob);
    return {
      text: cleanOCRText(result.data.text || ""),
      confidence: result.data.confidence || 0,
    };
  } finally {
    await worker.terminate();
  }
}

export function usePdfOcrManager() {
  const [state, setState] = useState<OcrManagerState>({
    flowState: "idle",
    selectedRect: null,
    ocrResult: null,
    editedText: "",
    language: DEFAULT_LANGUAGE,
    error: null,
    lastImageData: null,
  });

  const abortRef = useRef(false);

  const enterOcrMode = useCallback(() => {
    abortRef.current = false;
    setState({
      flowState: "selecting",
      selectedRect: null,
      ocrResult: null,
      editedText: "",
      language: DEFAULT_LANGUAGE,
      error: null,
      lastImageData: null,
    });
  }, []);

  const exitOcrMode = useCallback(() => {
    abortRef.current = true;
    setState({
      flowState: "idle",
      selectedRect: null,
      ocrResult: null,
      editedText: "",
      language: DEFAULT_LANGUAGE,
      error: null,
      lastImageData: null,
    });
  }, []);

  const performOcr = useCallback(
    async (dataUrl: string, language: string): Promise<OCRResult> => {
      if (isTauri()) {
        // Ensure the backend OCR processor is initialized
        const settings = useSettingsStore.getState().settings.documents.ocr;
        await ensureOCRConfig(settings);
        return runOcrBackend(dataUrlToBase64(dataUrl), language);
      }
      return runOcrBrowser(dataUrl, language);
    },
    []
  );

  const handleRegionSelected = useCallback(
    async (rect: SelectionRect, canvas: HTMLCanvasElement) => {
      try {
        const dataUrl = captureCanvasRegion(canvas, rect);
        setState((prev) => ({
          ...prev,
          flowState: "processing",
          selectedRect: rect,
          lastImageData: isTauri() ? dataUrlToBase64(dataUrl) : dataUrl,
          error: null,
        }));

        const result = await performOcr(dataUrl, state.language);

        if (abortRef.current) return;

        setState((prev) => ({
          ...prev,
          flowState: result.text.trim() ? "previewing" : "error",
          ocrResult: result,
          editedText: result.text,
          error: result.text.trim() ? null : "No text was detected in the selected region.",
        }));
      } catch (err) {
        if (abortRef.current) return;
        setState((prev) => ({
          ...prev,
          flowState: "error",
          error: `OCR failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        }));
      }
    },
    [state.language, performOcr]
  );

  const retryOcr = useCallback(
    async (language?: string) => {
      if (!state.lastImageData) return;
      const lang = language ?? state.language;

      setState((prev) => ({
        ...prev,
        flowState: "processing",
        error: null,
        ...(language ? { language } : {}),
      }));

      try {
        let result: OCRResult;
        if (isTauri()) {
          result = await runOcrBackend(state.lastImageData, lang);
        } else {
          result = await runOcrBrowser(state.lastImageData, lang);
        }

        if (abortRef.current) return;

        setState((prev) => ({
          ...prev,
          flowState: result.text.trim() ? "previewing" : "error",
          ocrResult: result,
          editedText: result.text,
          error: result.text.trim() ? null : "No text was detected in the selected region.",
        }));
      } catch (err) {
        if (abortRef.current) return;
        setState((prev) => ({
          ...prev,
          flowState: "error",
          error: `OCR failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        }));
      }
    },
    [state.lastImageData, state.language]
  );

  const setEditedText = useCallback((text: string) => {
    setState((prev) => ({ ...prev, editedText: text }));
  }, []);

  const setLanguage = useCallback((language: string) => {
    setState((prev) => ({ ...prev, language }));
  }, []);

  return {
    ...state,
    enterOcrMode,
    exitOcrMode,
    handleRegionSelected,
    retryOcr,
    setEditedText,
    setLanguage,
  };
}
