import { describe, expect, it } from "vitest";
import { createPdfLoadSourceFactories } from "../pdfLoadSources";

describe("createPdfLoadSourceFactories", () => {
  it("creates a fresh data buffer for each PDF.js load attempt", () => {
    const original = new Uint8Array([37, 80, 68, 70]);
    const sources = createPdfLoadSourceFactories({
      fileData: original,
      disableFontFace: true,
    });

    expect(sources).toHaveLength(1);

    const first = sources[0].create().data as Uint8Array;
    const second = sources[0].create().data as Uint8Array;

    expect(Array.from(first)).toEqual(Array.from(original));
    expect(Array.from(second)).toEqual(Array.from(original));
    expect(first).not.toBe(second);
    expect(first.buffer).not.toBe(second.buffer);
    expect(first.buffer).not.toBe(original.buffer);
    expect(second.buffer).not.toBe(original.buffer);
  });

  it("preserves URL load options", () => {
    const sources = createPdfLoadSourceFactories({
      fileUrl: "asset://example.pdf",
      disableFontFace: false,
    });

    expect(sources[0].create()).toMatchObject({
      url: "asset://example.pdf",
      verbosity: 0,
      disableRange: true,
      disableStream: true,
      disableAutoFetch: true,
      disableFontFace: false,
    });
  });
});
