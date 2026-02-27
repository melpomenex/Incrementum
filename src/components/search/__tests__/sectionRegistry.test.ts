import { describe, expect, it } from "vitest";
import { findMatchingSections } from "../sectionRegistry";

describe("sectionRegistry", () => {
  it("matches sections by label", () => {
    const matches = findMatchingSections("settings");
    expect(matches[0]?.section.id).toBe("settings");
  });

  it("matches sections by alias", () => {
    const matches = findMatchingSections("prefs");
    expect(matches[0]?.section.id).toBe("settings");
  });
});
