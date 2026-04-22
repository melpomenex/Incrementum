import { describe, expect, it } from "vitest";
import { applyAnchoredTextHighlights, buildTextSelectionContext } from "../textHighlights";

describe("textHighlights", () => {
  it("builds a text selection context with stable offsets", () => {
    document.body.innerHTML = `<div id="root"><p>Hello <strong>world</strong> again</p></div>`;
    const root = document.getElementById("root") as HTMLElement;
    const strongText = root.querySelector("strong")?.firstChild as Text;
    const trailingText = root.querySelector("p")?.lastChild as Text;

    const range = document.createRange();
    range.setStart(strongText, 0);
    range.setEnd(trailingText, 6);

    const context = buildTextSelectionContext({
      root,
      range,
      documentId: "doc-1",
      surface: "markdown",
    });

    expect(context).toMatchObject({
      type: "text",
      surface: "markdown",
      documentId: "doc-1",
      startOffset: 6,
      endOffset: 17,
      selectedText: "world again",
    });
  });

  it("rehydrates anchored highlights into rendered HTML", () => {
    document.body.innerHTML = `<div id="root"><p>Hello <strong>world</strong> again</p></div>`;
    const root = document.getElementById("root") as HTMLElement;

    applyAnchoredTextHighlights({
      root,
      signature: "demo",
      highlights: [
        { id: "h1", startOffset: 6, endOffset: 11, color: "#bbf7d0", title: "world" },
      ],
    });

    const marks = root.querySelectorAll("mark.persisted-text-highlight");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("world");
    expect(marks[0].getAttribute("title")).toBe("world");
  });
});
