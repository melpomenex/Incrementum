import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

/**
 * Tests for document replication conflict resolution.
 *
 * The shared yjs 'documents' map is attached once (module singleton); each
 * test writes a distinct doc id so the observer handles them independently
 * without needing module re-import. This validates the core fix — remote
 * document rows upsert into local SQLite — plus the dateModified conflict rule.
 */

const mocks = vi.hoisted(() => ({
  invokeCommand: vi.fn(),
  getYjsSync: vi.fn(),
  loadDocuments: vi.fn().mockResolvedValue(undefined),
  localDocuments: [] as import("../../types").Document[],
}));

vi.mock("../tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tauri")>();
  return { ...actual, isTauri: () => true, invokeCommand: mocks.invokeCommand };
});
vi.mock("../yjsSync", () => ({ getYjsSync: mocks.getYjsSync }));
vi.mock("../stores/documentStore", () => ({
  useDocumentStore: {
    getState: () => ({
      // Defensive: handlers may run async after test cleanup; always return an array.
      documents: mocks.localDocuments ?? [],
      loadDocuments: mocks.loadDocuments,
    }),
    setState: vi.fn(),
  },
}));

import type { Document } from "../../types";

let map: ReturnType<typeof makeFakeMap>;

function makeFakeMap() {
  const store = new Map<string, Document>();
  const observers: Array<(e: { keysChanged: Set<string> }) => void> = [];
  return {
    get: (k: string) => store.get(k),
    set: (k: string, v: Document) => { store.set(k, v); observers.forEach((fn) => fn({ keysChanged: new Set([k]) })); },
    forEach: (fn: (v: Document, k: string) => void) => store.forEach(fn),
    observe: (fn: (e: { keysChanged: Set<string> }) => void) => observers.push(fn),
  };
}

function makeDoc(id: string, overrides: Partial<Document> = {}): Document {
  return {
    id,
    title: `${id}.epub`,
    filePath: `/data/${id}.epub`,
    fileType: "epub",
    tags: [],
    dateAdded: "2026-01-01T00:00:00.000Z",
    dateModified: "2026-01-01T00:00:00.000Z",
    extractCount: 0, learningItemCount: 0, priorityRating: 0, prioritySlider: 0, priorityScore: 0,
    isArchived: false, isFavorite: false,
    ...overrides,
  };
}

beforeAll(async () => {
  map = makeFakeMap();
  mocks.getYjsSync.mockResolvedValue({ doc: { getMap: () => map } });
  mocks.invokeCommand.mockResolvedValue({});
  const { ensureDocumentReplicationReady } = await import("../documentReplication");
  await ensureDocumentReplicationReady();
});

// Reset per-test shared state without re-importing the module (the observer
// singleton must persist). localDocuments defaults to empty each test.
beforeEach(() => {
  mocks.localDocuments = [];
});

describe("documentReplication conflict resolution", () => {
  it("upserts a brand-new remote doc into local SQLite", async () => {
    map.set("doc-new", makeDoc("doc-new"));

    await vi.waitFor(() => {
      const calls = mocks.invokeCommand.mock.calls.filter(
        (c) => (c[1] as { document: Document }).document?.id === "doc-new",
      );
      expect(calls.length).toBe(1);
    });
  });

  it("does NOT upsert a remote doc older than the local copy", async () => {
    mocks.localDocuments = [makeDoc("doc-skip", { dateModified: "2026-06-01T00:00:00.000Z" })];
    map.set("doc-skip", makeDoc("doc-skip", { dateModified: "2026-01-01T00:00:00.000Z" }));

    // Give the async handler time to (not) run.
    await new Promise((r) => setTimeout(r, 100));
    const calls = mocks.invokeCommand.mock.calls.filter(
      (c) => (c[1] as { document: Document }).document?.id === "doc-skip",
    );
    expect(calls.length).toBe(0);
  });
});
