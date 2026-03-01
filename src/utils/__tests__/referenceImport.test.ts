import { describe, expect, it } from "vitest";
import { parseMendeleyItems, parseZoteroItems } from "../referenceImport";

describe("referenceImport", () => {
  it("parses Zotero exports into normalized items", () => {
    const parsed = parseZoteroItems([
      {
        data: {
          title: "Spaced repetition paper",
          abstractNote: "Abstract text",
          url: "https://example.com/paper",
          creators: [{ firstName: "Piotr", lastName: "Wozniak" }],
          date: "2024-02-14",
          publicationTitle: "Memory Journal",
        },
      },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      title: "Spaced repetition paper",
      author: "Piotr Wozniak",
      source: "zotero",
      venue: "Memory Journal",
      year: 2024,
    });
  });

  it("parses Mendeley exports into normalized items", () => {
    const parsed = parseMendeleyItems([
      {
        title: "Forgetting Curves",
        abstract: "A study",
        websites: ["https://example.com/curve"],
        authors: [{ first_name: "Ada", last_name: "Lovelace" }],
        year: 2021,
        source: "Cognitive Science",
      },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      title: "Forgetting Curves",
      author: "Ada Lovelace",
      source: "mendeley",
      venue: "Cognitive Science",
      year: 2021,
    });
  });
});
