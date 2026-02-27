import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalSearch, SearchResultType, type SearchQuery, type SearchResult } from "../GlobalSearch";

describe("GlobalSearch keyboard navigation", () => {
  const buildResults = (): SearchResult[] => [
    {
      id: "section-settings",
      type: SearchResultType.Command,
      title: "Settings",
      excerpt: "Open Settings",
      score: 1,
      metadata: {
        resultKind: "section",
      },
    },
    {
      id: "doc-1",
      type: SearchResultType.Document,
      title: "My Document",
      score: 0.9,
      metadata: {
        documentId: "doc-1",
      },
    },
  ];

  it("activates highlighted section with Enter", async () => {
    const onResultClick = vi.fn();
    const onSearch = vi.fn(async (_query: SearchQuery) => buildResults());

    render(
      <GlobalSearch
        isOpen={true}
        onOpenChange={vi.fn()}
        hideTrigger={true}
        onSearch={onSearch}
        onResultClick={onResultClick}
      />
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "settings" } });
    await act(async () => {});

    await waitFor(() => expect(screen.getByText("Settings")).toBeInTheDocument(), { timeout: 2000 });

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onResultClick).toHaveBeenCalledWith(expect.objectContaining({ id: "section-settings" }));
  });

  it("supports ArrowDown then Enter for mixed results and keeps document-open behavior", async () => {
    const onResultClick = vi.fn();
    const onSearch = vi.fn(async (_query: SearchQuery) => buildResults());

    render(
      <GlobalSearch
        isOpen={true}
        onOpenChange={vi.fn()}
        hideTrigger={true}
        onSearch={onSearch}
        onResultClick={onResultClick}
      />
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "set" } });
    await act(async () => {});

    await waitFor(() => expect(screen.getByText("My Document")).toBeInTheDocument(), { timeout: 2000 });

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(onResultClick).toHaveBeenCalledWith(expect.objectContaining({
      id: "doc-1",
      type: SearchResultType.Document,
    }));
  });
});
