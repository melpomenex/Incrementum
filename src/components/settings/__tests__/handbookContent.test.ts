import { describe, expect, it } from "vitest";

import { getHandbookMarkdown, stripEmbeddedTableOfContents } from "../handbookContent";

describe("handbookContent", () => {
  it("normalizes generated markdown before stripping the localized table of contents", () => {
    const markdown = "# 标题\n\n---## 目录\n\n1. [简介](#intro)\n\n## 简介\n\n正文\n";
    expect(stripEmbeddedTableOfContents(markdown)).toBe("# 标题\n\n---\n\n## 简介\n\n正文\n");
  });

  it("strips the embedded handbook table of contents", () => {
    const markdown = "# Title\n\n## Table of Contents\n\n1. [Intro](#intro)\n\n## Intro\n\nBody\n";
    expect(stripEmbeddedTableOfContents(markdown)).toBe("# Title\n\n## Intro\n\nBody\n");
  });

  it("returns localized handbook markdown when available", () => {
    expect(getHandbookMarkdown("zh")).toContain("# Incrementum 用户手册");
    expect(getHandbookMarkdown("ja")).toContain("# インクリメンタム ユーザー ハンドブック");
    expect(getHandbookMarkdown("en")).toContain("# Incrementum User Handbook");
  });
});
