import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for the document → file-sync manifest bridge.
 *
 * Verifies that `registerImportedFileSync`:
 *   - hashes the imported file via the Tauri command (not base64 round-trip)
 *   - adds a FileManifestEntry with the real room id
 *   - registers local bytes with the transfer manager
 *   - stamps the returned fileId onto the document
 *   - short-circuits when the doc already has a fileId (re-import)
 *   - is non-fatal when sync isn't available (returns null, no throw)
 */

const mocks = vi.hoisted(() => ({
  invokeCommand: vi.fn(),
  getYjsSync: vi.fn().mockResolvedValue({}),
  getSyncRoomId: vi.fn().mockReturnValue("room-test-123"),
  ensureFileSyncReady: vi.fn().mockResolvedValue(undefined),
  getFileManifest: vi.fn(),
  getFileTransferManager: vi.fn(),
  readDocumentFile: vi.fn(),
}));

vi.mock("../tauri", () => ({
  isTauri: () => true,
  invokeCommand: mocks.invokeCommand,
}));

vi.mock("../yjsSync", () => ({
  getYjsSync: mocks.getYjsSync,
  getSyncRoomId: mocks.getSyncRoomId,
}));

vi.mock("../useFileSync", () => ({
  ensureFileSyncReady: mocks.ensureFileSyncReady,
  getFileManifest: mocks.getFileManifest,
  getFileTransferManager: mocks.getFileTransferManager,
}));

vi.mock("../../api/documents", () => ({
  readDocumentFile: mocks.readDocumentFile,
}));

import { registerImportedFileSync } from "../fileSyncRegistration";
import type { Document } from "../../types";

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-1",
    title: "Test.pdf",
    filePath: "/data/Test.pdf",
    fileType: "pdf",
    tags: [],
    dateAdded: "2026-01-01",
    dateModified: "2026-01-01",
    extractCount: 0,
    learningItemCount: 0,
    priorityRating: 0,
    prioritySlider: 0,
    priorityScore: 0,
    isArchived: false,
    isFavorite: false,
    ...overrides,
  };
}

function makeManifestMock() {
  const entries = new Map<string, Record<string, unknown>>();
  return {
    addFile: vi.fn((entry: Record<string, unknown>) => { entries.set(entry.id as string, entry); }),
    findByHash: vi.fn(() => [] as Record<string, unknown>[]),
    getFile: vi.fn((id: string) => entries.get(id) ?? null),
  };
}

function makeTransferManagerMock() {
  return {
    registerLocalFile: vi.fn(),
    registerLocalFileLoader: vi.fn(),
    hasFileLocal: vi.fn(() => false),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerImportedFileSync", () => {
  it("hashes the file, adds a manifest entry, registers local bytes, returns fileId", async () => {
    mocks.invokeCommand.mockResolvedValueOnce(["abc123hash", 1024] as [string, number]);
    mocks.readDocumentFile.mockResolvedValueOnce("dGVzdA=="); // "test"
    const manifest = makeManifestMock();
    const transferManager = makeTransferManagerMock();
    mocks.getFileManifest.mockReturnValue(manifest);
    mocks.getFileTransferManager.mockReturnValue(transferManager);

    const doc = makeDoc();
    const fileId = await registerImportedFileSync(doc);

    // Hashed via the Rust command (not base64 over IPC).
    expect(mocks.invokeCommand).toHaveBeenCalledWith("hash_document_file", { filePath: "/data/Test.pdf" });

    // Manifest entry added with the real room id (not device id placeholder).
    expect(manifest.addFile).toHaveBeenCalledTimes(1);
    const entry = manifest.addFile.mock.calls[0][0] as {
      id: string; contentHash: string; sizeBytes: number; room: string; contentType: string;
    };
    expect(entry.contentHash).toBe("abc123hash");
    expect(entry.sizeBytes).toBe(1024);
    expect(entry.room).toBe("room-test-123");
    expect(entry.contentType).toBe("application/pdf");
    expect(entry.id).toBeTruthy();

    // Local bytes registered for serving via a lazy loader (not eagerly read).
    expect(transferManager.registerLocalFileLoader).toHaveBeenCalledTimes(1);
    expect(transferManager.registerLocalFileLoader.mock.calls[0][0]).toBe(entry.id);
    // The loader is a function that returns a Promise<Blob>.
    expect(typeof transferManager.registerLocalFileLoader.mock.calls[0][1]).toBe("function");

    // fileId returned. (The caller — documentStore — stamps it onto the doc;
    // registerImportedFileSync returns it rather than mutating the document, so
    // the import flow controls when the store-visible update happens.)
    expect(fileId).toBe(entry.id);
  });

  it("short-circuits when the doc already has a fileId (re-import)", async () => {
    const doc = makeDoc({ fileId: "existing-file-id" });
    const fileId = await registerImportedFileSync(doc);

    expect(fileId).toBe("existing-file-id");
    expect(mocks.invokeCommand).not.toHaveBeenCalled();
    expect(mocks.ensureFileSyncReady).not.toHaveBeenCalled();
  });

  it("returns null without throwing when sync init fails (non-fatal)", async () => {
    mocks.getYjsSync.mockRejectedValueOnce(new Error("sync unavailable"));
    const doc = makeDoc();
    const fileId = await registerImportedFileSync(doc);

    expect(fileId).toBeNull();
  });

  it("reuses an existing manifest entry when the content hash matches (dedup)", async () => {
    mocks.invokeCommand.mockResolvedValueOnce(["sharedhash", 512] as [string, number]);
    mocks.readDocumentFile.mockResolvedValueOnce("dGVzdA==");
    const manifest = makeManifestMock();
    manifest.findByHash.mockReturnValueOnce([{ id: "already-known-file" }]);
    mocks.getFileManifest.mockReturnValue(manifest);
    mocks.getFileTransferManager.mockReturnValue(makeTransferManagerMock());

    const doc = makeDoc();
    const fileId = await registerImportedFileSync(doc);

    expect(fileId).toBe("already-known-file");
    expect(manifest.addFile).not.toHaveBeenCalled();
  });
});
