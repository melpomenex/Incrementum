import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  notebooklmAddSource,
  notebooklmGenerateArtifact,
  notebooklmPreviewFlashcards,
  notebooklmSyncPreviewItems,
} from "../integrations";

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
  convertFileSrc: vi.fn((path: string) => path),
}));

describe("NotebookLM workflow integration", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("runs source ingestion -> artifact generation -> preview -> deck sync", async () => {
    mockInvoke
      .mockResolvedValueOnce({
        id: "src_1",
        title: "Sample source",
        kind: "url",
        status: "ready",
      })
      .mockResolvedValueOnce({
        id: "job_1",
        notebookId: "nb_1",
        artifactType: "flashcards",
        status: "succeeded",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payload: { flashcards: [], quizItems: [] },
      })
      .mockResolvedValueOnce([
        {
          question: "Q1",
          answer: "A1",
          tags: ["notebooklm"],
          sourceNotebookId: "nb_1",
          sourceArtifactId: "art_1",
        },
      ])
      .mockResolvedValueOnce({
        created: 1,
        updated: 0,
        skipped: 0,
        itemIds: ["li_1"],
      });

    await notebooklmAddSource({
      notebookId: "nb_1",
      kind: "url",
      content: "https://example.com",
    });
    const job = await notebooklmGenerateArtifact({
      notebookId: "nb_1",
      artifactType: "flashcards",
      retryCount: 1,
    });
    const preview = await notebooklmPreviewFlashcards(job.id);
    const sync = await notebooklmSyncPreviewItems({
      previewItems: preview,
      deckName: "NotebookLM Imports",
      dedupe: true,
    });

    expect(sync.created).toBe(1);
    expect(mockInvoke).toHaveBeenCalledWith("notebooklm_add_source", {
      req: {
        notebookId: "nb_1",
        kind: "url",
        content: "https://example.com",
      },
    });
    expect(mockInvoke).toHaveBeenCalledWith("notebooklm_generate_artifact", {
      req: {
        notebookId: "nb_1",
        artifactType: "flashcards",
        retryCount: 1,
      },
    });
    expect(mockInvoke).toHaveBeenCalledWith("notebooklm_preview_flashcards", {
      jobId: "job_1",
    });
    expect(mockInvoke).toHaveBeenCalledWith("notebooklm_sync_preview_items", {
      previewItems: preview,
      deckName: "NotebookLM Imports",
      dedupe: true,
    });
  });
});
