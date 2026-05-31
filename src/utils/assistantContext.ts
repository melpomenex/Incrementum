import type { Document } from "../types/document";

export type AssistantContextStatus = "ready" | "loading" | "unavailable";

export type AssistantContextSource =
  | "selection"
  | "pdf-window"
  | "ocr"
  | "document-content"
  | "video-transcript"
  | "document"
  | "none";

export interface ResolvedAssistantContext {
  status: AssistantContextStatus;
  content?: string;
  source: AssistantContextSource;
  message?: string;
}

interface ResolvePdfAssistantContextParams {
  document?: Document | null;
  liveWindowText?: string;
  storedDocumentText?: string;
  ocrText?: string | null;
  selection?: string;
  pageNumber?: number;
  contextPageWindow?: number;
  preferOcr?: boolean;
  extractedTextLoader?: () => Promise<string | undefined>;
}

const PDF_TEXT_MIN_WORDS = 24;
const PDF_TEXT_MIN_CHARS = 160;

function normalizeWhitespace(value?: string | null): string {
  if (value == null) return "";
  const str = typeof value === "string" ? value : String(value);
  return str.replace(/\s+/g, " ").trim();
}

function stripHtml(value?: string | null): string {
  return normalizeWhitespace(value?.replace(/<[^>]+>/g, " "));
}

function hasUsableContextText(value?: string | null): boolean {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return normalized.length >= PDF_TEXT_MIN_CHARS || wordCount >= PDF_TEXT_MIN_WORDS;
}

function buildPdfContextContent(params: {
  title?: string;
  pageNumber?: number;
  contextPageWindow?: number;
  selection?: string;
  body: string;
  source: AssistantContextSource;
}): string {
  const lines: string[] = [];
  lines.push(`PDF document: ${params.title || "Untitled document"}`);

  if (params.pageNumber && params.pageNumber > 0) {
    const pageWindow = params.contextPageWindow ?? 2;
    const start = Math.max(1, params.pageNumber - pageWindow);
    const end = params.pageNumber + pageWindow;
    lines.push(`Active page: ${params.pageNumber}`);
    lines.push(`Nearby page window: ${start}-${end}`);
  }

  lines.push(`Context source: ${params.source}`);

  const selection = normalizeWhitespace(params.selection);
  if (selection) {
    lines.push("");
    lines.push("Selected text:");
    lines.push(selection);
  }

  lines.push("");
  lines.push("Document context:");
  lines.push(params.body);

  return lines.join("\n");
}

export function getAssistantContextErrorMessage(reason?: string): string {
  switch (reason) {
    case "loading":
      return "Document context is still loading. Try again in a moment.";
    case "unavailable":
      return "No text content available for this document. Transcribe the audio or extract text first, then try again.";
    default:
      return "Document context is unavailable for this request.";
  }
}

export async function resolvePdfAssistantContext(
  params: ResolvePdfAssistantContextParams
): Promise<ResolvedAssistantContext> {
  const selection = normalizeWhitespace(params.selection);
  const liveWindowText = normalizeWhitespace(params.liveWindowText);
  const ocrText = normalizeWhitespace(params.ocrText);
  let storedDocumentText = stripHtml(params.storedDocumentText);

  const preferOcr = Boolean(params.preferOcr);
  const preferredBody = preferOcr
    ? (hasUsableContextText(ocrText) ? ocrText : liveWindowText)
    : (hasUsableContextText(liveWindowText) ? liveWindowText : ocrText);

  let body = preferredBody;
  let source: AssistantContextSource = preferOcr
    ? (body === ocrText ? "ocr" : body === liveWindowText ? "pdf-window" : "none")
    : (body === liveWindowText ? "pdf-window" : body === ocrText ? "ocr" : "none");

  if (!hasUsableContextText(body) && hasUsableContextText(storedDocumentText)) {
    body = storedDocumentText;
    source = "document-content";
  }

  if (!hasUsableContextText(body) && params.extractedTextLoader) {
    try {
      const extracted = stripHtml(await params.extractedTextLoader());
      if (hasUsableContextText(extracted)) {
        storedDocumentText = extracted;
        body = extracted;
        source = "document-content";
      }
    } catch {
      // Ignore extraction errors here and let the caller surface the unavailable state.
    }
  }

  if (!hasUsableContextText(body) && !selection) {
    return {
      status: "unavailable",
      source: "none",
      message: getAssistantContextErrorMessage("unavailable"),
    };
  }

  const content = buildPdfContextContent({
    title: params.document?.title,
    pageNumber: params.pageNumber,
    contextPageWindow: params.contextPageWindow,
    selection,
    body: body || selection,
    source: selection && !body ? "selection" : source,
  });

  return {
    status: "ready",
    content,
    source: selection && !body ? "selection" : source,
  };
}

export function resolveGenericAssistantContext(content?: string, source: AssistantContextSource = "document"): ResolvedAssistantContext {
  const normalized = normalizeWhitespace(content);
  if (!normalized) {
    return {
      status: "unavailable",
      source: "none",
      message: getAssistantContextErrorMessage("unavailable"),
    };
  }

  return {
    status: "ready",
    source,
    content: normalized,
  };
}
