import { describe, expect, it, vi } from "vitest";
import type { Document } from "../../types/document";
import { resolveGenericAssistantContext, resolvePdfAssistantContext } from "../assistantContext";

const baseDocument = (overrides: Partial<Document> = {}): Document => ({
  id: "doc-1",
  title: "Test PDF",
  filePath: "/tmp/test.pdf",
  fileType: "pdf",
  tags: [],
  dateAdded: "2026-01-01T00:00:00.000Z",
  dateModified: "2026-01-01T00:00:00.000Z",
  extractCount: 0,
  learningItemCount: 0,
  priorityRating: 0,
  prioritySlider: 0,
  priorityScore: 0,
  isArchived: false,
  isFavorite: false,
  ...overrides,
});

const longText = (label: string) =>
  `${label} `.repeat(80).trim();

describe("resolvePdfAssistantContext", () => {
  it("prefers live PDF window text when it is available", async () => {
    const result = await resolvePdfAssistantContext({
      document: baseDocument(),
      liveWindowText: longText("window"),
      storedDocumentText: longText("document"),
      pageNumber: 12,
      contextPageWindow: 2,
    });

    expect(result.status).toBe("ready");
    expect(result.source).toBe("pdf-window");
    expect(result.content).toContain("Active page: 12");
    expect(result.content).toContain("Context source: pdf-window");
  });

  it("falls back to OCR text when the live PDF window is weak", async () => {
    const result = await resolvePdfAssistantContext({
      document: baseDocument(),
      liveWindowText: "too short",
      ocrText: longText("ocr"),
      preferOcr: true,
    });

    expect(result.status).toBe("ready");
    expect(result.source).toBe("ocr");
    expect(result.content).toContain("Context source: ocr");
  });

  it("loads extracted document text when the PDF window is empty", async () => {
    const loader = vi.fn(async () => "<p>" + longText("extracted") + "</p>");
    const result = await resolvePdfAssistantContext({
      document: baseDocument(),
      liveWindowText: "",
      extractedTextLoader: loader,
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("ready");
    expect(result.source).toBe("document-content");
    expect(result.content).toContain("extracted extracted");
  });

  it("returns unavailable when no usable PDF text source exists", async () => {
    const result = await resolvePdfAssistantContext({
      document: baseDocument(),
      liveWindowText: "",
      storedDocumentText: "",
    });

    expect(result.status).toBe("unavailable");
    expect(result.source).toBe("none");
    expect(result.message).toContain("No text content available");
  });
});

describe("resolveGenericAssistantContext", () => {
  it("marks empty generic context as unavailable", () => {
    const result = resolveGenericAssistantContext("");
    expect(result.status).toBe("unavailable");
  });
});
