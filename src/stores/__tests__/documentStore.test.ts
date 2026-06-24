import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the api layer so the store hits our fake implementations.
const bulkDeleteDocumentsMock = vi.fn();
const pickFolderDocumentsMock = vi.fn();
const importDocumentMock = vi.fn();
const loadDocumentsMock = vi.fn();
vi.mock("../../api/documents", () => ({
  bulkDeleteDocuments: (...args: unknown[]) => bulkDeleteDocumentsMock(...args),
  pickFolderDocuments: (...args: unknown[]) => pickFolderDocumentsMock(...args),
  importDocument: (...args: unknown[]) => importDocumentMock(...args),
  // loadDocuments is destructured as documentsApi.loadDocuments in the store.
  loadDocuments: (...args: unknown[]) => loadDocumentsMock(...args),
}));

vi.mock("../../api/segmentation", () => ({ segmentDocument: vi.fn() }));
vi.mock("../settingsStore", () => ({
  useSettingsStore: { getState: () => ({ settings: { documents: {} } }) },
}));
vi.mock("../collectionStore", () => ({
  useCollectionStore: { getState: () => ({ activeCollectionId: null }) },
}));
vi.mock("../../utils/documentImport", () => ({
  importFromUrl: vi.fn(),
  importFromArxiv: vi.fn(),
}));
vi.mock("../../lib/tauri", () => ({ listen: vi.fn(), isTauri: () => false }));
vi.mock("../../components/common/Toast", () => ({
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
  ToastType: { Success: "success", Error: "error", Info: "info" },
}));

import { useDocumentStore } from "../documentStore";
import type { Document } from "../../types/document";

function makeDoc(id: string): Document {
  return {
    id,
    title: `Doc ${id}`,
    filePath: `/tmp/${id}.pdf`,
    fileType: "pdf",
    tags: [],
    dateAdded: "2024-01-01T00:00:00.000Z",
    dateModified: "2024-01-01T00:00:00.000Z",
    extractCount: 0,
    learningItemCount: 0,
    priorityRating: 0,
    prioritySlider: 0,
    priorityScore: 0,
    isArchived: false,
    isFavorite: false,
  };
}

describe("documentStore.bulkDelete", () => {
  beforeEach(() => {
    bulkDeleteDocumentsMock.mockReset();
    useDocumentStore.setState({
      documents: [makeDoc("a"), makeDoc("b"), makeDoc("c")],
      currentDocument: null,
    });
  });

  it("removes successfully-deleted documents from state", async () => {
    bulkDeleteDocumentsMock.mockResolvedValue({
      succeeded: ["a", "b"],
      failed: [],
      errors: [],
    });

    const result = await useDocumentStore.getState().bulkDelete(["a", "b"]);

    expect(bulkDeleteDocumentsMock).toHaveBeenCalledWith(["a", "b"]);
    expect(result.succeeded).toEqual(["a", "b"]);

    const docs = useDocumentStore.getState().documents;
    expect(docs.map((d) => d.id)).toEqual(["c"]);
  });

  it("retains documents that failed to delete", async () => {
    bulkDeleteDocumentsMock.mockResolvedValue({
      succeeded: ["a"],
      failed: ["b"],
      errors: ["b: boom"],
    });

    await useDocumentStore.getState().bulkDelete(["a", "b"]);

    const docs = useDocumentStore.getState().documents;
    // 'a' removed; 'b' and 'c' survive.
    expect(docs.map((d) => d.id).sort()).toEqual(["b", "c"]);
  });

  it("clears currentDocument when it was among the deleted", async () => {
    useDocumentStore.setState({ currentDocument: makeDoc("a") });
    bulkDeleteDocumentsMock.mockResolvedValue({
      succeeded: ["a"],
      failed: [],
      errors: [],
    });

    await useDocumentStore.getState().bulkDelete(["a"]);

    expect(useDocumentStore.getState().currentDocument).toBeNull();
  });

  it("is a no-op for an empty id list", async () => {
    const result = await useDocumentStore.getState().bulkDelete([]);

    expect(bulkDeleteDocumentsMock).not.toHaveBeenCalled();
    expect(result.succeeded).toEqual([]);
    expect(useDocumentStore.getState().documents).toHaveLength(3);
  });
});

describe("documentStore.importFromFolder", () => {
  beforeEach(() => {
    pickFolderDocumentsMock.mockReset();
    importDocumentMock.mockReset();
    loadDocumentsMock.mockReset();
    useDocumentStore.setState({ documents: [] });
  });

  it("imports all staged files returned by the folder picker", async () => {
    pickFolderDocumentsMock.mockResolvedValue([
      { path: "/imports/Sci-Fi/Dune.epub", relativePath: "Sci-Fi/Dune.epub", fileName: "Dune.epub" },
      { path: "/imports/guide.pdf", relativePath: "guide.pdf", fileName: "guide.pdf" },
    ]);
    importDocumentMock.mockImplementation(async (filePath: string) =>
      makeDoc(filePath.split("/").pop() || filePath)
    );
    loadDocumentsMock.mockResolvedValue(undefined);

    const result = await useDocumentStore.getState().importFromFolder();

    expect(pickFolderDocumentsMock).toHaveBeenCalledWith();
    expect(importDocumentMock).toHaveBeenCalledTimes(2);
    expect(importDocumentMock).toHaveBeenCalledWith("/imports/Sci-Fi/Dune.epub", null);
    expect(importDocumentMock).toHaveBeenCalledWith("/imports/guide.pdf", null);
    expect(result).toHaveLength(2);
  });

  it("returns an empty list and toasts when the folder has no supported files", async () => {
    pickFolderDocumentsMock.mockResolvedValue([]);

    const result = await useDocumentStore.getState().importFromFolder();

    expect(pickFolderDocumentsMock).toHaveBeenCalled();
    expect(importDocumentMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
    expect(useDocumentStore.getState().isImporting).toBe(false);
  });
});
