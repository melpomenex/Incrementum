import { afterEach, describe, expect, it } from "vitest";
import type { PdfSelectionContext } from "../../../types/selection";
import {
  derivePdfTextSelectionCapability,
  getPdfExtractBlockReason,
  hasSelectableTextInLayer,
  isValidPdfSelection,
  selectionAnchorsInTextLayers,
  selectionIntersectsTextLayers,
} from "../pdfTextSelection";

function createPdfContext(): PdfSelectionContext {
  return {
    type: "pdf",
    documentId: "doc-1",
    pages: [
      {
        pageNumber: 1,
        viewportRects: [{ left: 0, top: 0, width: 100, height: 20 }],
        pdfRects: [{ x1: 0, y1: 0, x2: 100, y2: 20 }],
      },
    ],
  };
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = "";
});

describe("pdfTextSelection helpers", () => {
  it("detects selectable text in a text layer", () => {
    document.body.innerHTML = `
      <div id="layer">
        <span>   </span>
        <span>Hello</span>
      </div>
    `;
    const layer = document.getElementById("layer");
    expect(hasSelectableTextInLayer(layer)).toBe(true);
  });

  it("derives capability state from page availability map", () => {
    const availability = new Map<number, boolean>([
      [1, false],
      [2, true],
      [3, false],
    ]);

    const capability = derivePdfTextSelectionCapability(availability, 10, 2);
    expect(capability.hasSelectableText).toBe(true);
    expect(capability.pagesWithSelectableText).toBe(1);
    expect(capability.analyzedPages).toBe(3);
    expect(capability.currentPageHasSelectableText).toBe(true);
    expect(capability.totalPages).toBe(10);
  });

  it("validates that selection starts/ends in text layers and intersects them", () => {
    document.body.innerHTML = `
      <div id="layer"><span id="a">Hello</span><span id="b">World</span></div>
      <p id="outside">Outside</p>
    `;
    const layer = document.getElementById("layer") as HTMLElement;
    const aNode = document.getElementById("a")?.firstChild;
    const bNode = document.getElementById("b")?.firstChild;
    expect(aNode).toBeTruthy();
    expect(bNode).toBeTruthy();

    const selection = window.getSelection();
    expect(selection).toBeTruthy();
    if (!selection || !aNode || !bNode) return;

    const range = document.createRange();
    range.setStart(aNode, 0);
    range.setEnd(bNode, 5);
    selection.removeAllRanges();
    selection.addRange(range);

    expect(selectionAnchorsInTextLayers(selection, [layer])).toBe(true);
    expect(selectionIntersectsTextLayers(selection, [layer])).toBe(true);
  });

  it("rejects selections that extend outside the PDF text layer", () => {
    document.body.innerHTML = `
      <div id="layer"><span id="inside">Inside</span></div>
      <p id="outside">Outside</p>
    `;
    const layer = document.getElementById("layer") as HTMLElement;
    const insideNode = document.getElementById("inside")?.firstChild;
    const outsideNode = document.getElementById("outside")?.firstChild;
    expect(insideNode).toBeTruthy();
    expect(outsideNode).toBeTruthy();

    const selection = window.getSelection();
    expect(selection).toBeTruthy();
    if (!selection || !insideNode || !outsideNode) return;

    const range = document.createRange();
    range.setStart(insideNode, 0);
    range.setEnd(outsideNode, 3);
    selection.removeAllRanges();
    selection.addRange(range);

    expect(selectionAnchorsInTextLayers(selection, [layer])).toBe(false);
    expect(selectionIntersectsTextLayers(selection, [layer])).toBe(true);
  });

  it("gates PDF extract creation by valid selection and page capability", () => {
    const context = createPdfContext();
    expect(isValidPdfSelection("selected text", context)).toBe(true);
    expect(isValidPdfSelection("   ", context)).toBe(false);

    expect(
      getPdfExtractBlockReason({
        selectedText: "selected text",
        selectionContext: context,
        capability: {
          hasSelectableText: true,
          currentPageHasSelectableText: true,
          pagesWithSelectableText: 1,
          analyzedPages: 1,
          totalPages: 1,
        },
      }),
    ).toBeNull();

    expect(
      getPdfExtractBlockReason({
        selectedText: "",
        selectionContext: null,
        capability: {
          hasSelectableText: false,
          currentPageHasSelectableText: false,
          pagesWithSelectableText: 0,
          analyzedPages: 2,
          totalPages: 2,
        },
      }),
    ).toBe("no_text_layer");

    expect(
      getPdfExtractBlockReason({
        selectedText: "",
        selectionContext: null,
        capability: {
          hasSelectableText: true,
          currentPageHasSelectableText: true,
          pagesWithSelectableText: 1,
          analyzedPages: 1,
          totalPages: 1,
        },
      }),
    ).toBe("missing_selection");
  });
});
