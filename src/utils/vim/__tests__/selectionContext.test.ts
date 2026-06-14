/**
 * Tests for the vim SelectionContext bridge.
 *
 * Verifies that buildSelectionContext constructs a valid SelectionContext from
 * the live DOM selection for each doc type, and that it reads the LIVE
 * selection (not stale state).
 */
import { describe, it, expect, afterEach } from "vitest";
import { buildSelectionContext } from "../selectionContext";

afterEach(() => {
  window.getSelection()?.removeAllRanges();
});

function setDomSelection(startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

describe("buildSelectionContext", () => {
  it("returns null when no selection exists", () => {
    const r = buildSelectionContext({
      doc: document,
      docType: "markdown",
      documentId: "d1",
    });
    expect(r).toBeNull();
  });

  it("returns null for a collapsed selection", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>hello world</p>";
    document.body.appendChild(container);
    const text = container.querySelector("p")!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 0); // collapsed
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    const r = buildSelectionContext({ doc: document, docType: "markdown", documentId: "d1" });
    expect(r).toBeNull();
    container.remove();
  });

  it("builds a markdown TextSelectionContext with offsets", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>alpha beta gamma</p>";
    document.body.appendChild(container);
    const text = container.querySelector("p")!.firstChild!;
    setDomSelection(text, 6, text, 10); // "beta"

    const r = buildSelectionContext({ doc: document, docType: "markdown", documentId: "d1" });
    expect(r).not.toBeNull();
    expect(r!.type).toBe("text");
    const ctx = r as Extract<typeof r, { type: "text" }>;
    expect(ctx.surface).toBe("markdown");
    expect(ctx.documentId).toBe("d1");
    expect(ctx.selectedText).toContain("beta");
    expect(ctx.startOffset).toBeGreaterThanOrEqual(0);
    expect(ctx.endOffset).toBeGreaterThanOrEqual(ctx.startOffset);
    container.remove();
  });

  it("builds an html surface context when docType is html", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>hello world</p>";
    document.body.appendChild(container);
    const text = container.querySelector("p")!.firstChild!;
    setDomSelection(text, 0, text, 5); // "hello"

    const r = buildSelectionContext({ doc: document, docType: "html", documentId: "d1" });
    expect(r!.type).toBe("text");
    expect((r as any).surface).toBe("html");
    container.remove();
  });

  it("builds an epub context with the selected text (cfi placeholder)", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>chapter one text</p>";
    document.body.appendChild(container);
    const text = container.querySelector("p")!.firstChild!;
    setDomSelection(text, 0, text, 7); // "chapter"

    const r = buildSelectionContext({ doc: document, docType: "epub", documentId: "d1" });
    expect(r!.type).toBe("epub");
    const ctx = r as Extract<typeof r, { type: "epub" }>;
    expect(ctx.documentId).toBe("d1");
    expect(ctx.selectedText).toContain("chapter");
    container.remove();
  });

  it("reads the LIVE selection — two successive calls return different content", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>first second third</p>";
    document.body.appendChild(container);
    const text = container.querySelector("p")!.firstChild!;

    // First selection: "first"
    setDomSelection(text, 0, text, 5);
    const r1 = buildSelectionContext({ doc: document, docType: "markdown", documentId: "d1" });
    expect((r1 as any)?.selectedText).toContain("first");

    // Change selection to "third" — proves freshness (no stale state).
    setDomSelection(text, 13, text, 18);
    const r2 = buildSelectionContext({ doc: document, docType: "markdown", documentId: "d1" });
    expect((r2 as any)?.selectedText).toContain("third");

    container.remove();
  });

  it("pdf returns null when no high-fidelity builder is supplied", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>pdf text</p>";
    document.body.appendChild(container);
    const text = container.querySelector("p")!.firstChild!;
    setDomSelection(text, 0, text, 3);

    // Without a buildPdfContext callback, the helper can't produce page rects.
    const r = buildSelectionContext({ doc: document, docType: "pdf", documentId: "d1" });
    expect(r).toBeNull();
    container.remove();
  });

  it("pdf delegates to the supplied buildPdfContext", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>pdf text</p>";
    document.body.appendChild(container);
    const text = container.querySelector("p")!.firstChild!;
    setDomSelection(text, 0, text, 3);

    const fake = { type: "pdf" as const, documentId: "d1", pages: [] };
    const r = buildSelectionContext({
      doc: document,
      docType: "pdf",
      documentId: "d1",
      buildPdfContext: () => fake,
    });
    expect(r).toEqual(fake);
    container.remove();
  });
});
