import { describe, expect, it } from "vitest";
import { createEmptyCard, fsrs, type Grade } from "ts-fsrs";
import * as Y from "yjs";
import { FileManifest, type FileManifestEntry } from "../../lib/file-manifest";
import { gradeTypedAnswerSemantic } from "../semanticGrading";

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

describe("Wave5 performance checks", () => {
  it("scheduler simulation handles large review logs quickly", async () => {
    const scheduler = fsrs({
      request_retention: 0.9,
      maximum_interval: 36500,
      enable_fuzz: false,
    });
    const now = new Date();

    let card = createEmptyCard(now);
    let iterations = 0;

    const start = nowMs();
    for (let i = 0; i < 5000; i += 1) {
      const grade = ([1, 2, 3, 4] as Grade[])[i % 4];
      const next = scheduler.next(card, new Date(now.getTime() + i * 60_000), grade);
      card = next.card;
      iterations += 1;
    }
    const duration = nowMs() - start;

    expect(iterations).toBe(5000);
    expect(duration).toBeLessThan(4000);
  });

  it("AI grading routing path remains responsive under load", async () => {
    const start = nowMs();

    for (let i = 0; i < 250; i += 1) {
      await gradeTypedAnswerSemantic(
        {
          question: "What is FSRS?",
          expectedAnswer: "A modern spaced repetition scheduler",
          userAnswer: "A spaced repetition scheduler",
          route: "local-first",
        },
        {
          gradeWithLocal: async () => {
            throw new Error("local unavailable");
          },
          gradeWithCloud: async () => ({
            isCorrect: true,
            similarity: 0.92,
            provider: "cloud" as const,
          }),
        }
      );
    }

    const duration = nowMs() - start;
    expect(duration).toBeLessThan(3000);
  });

  it("sync manifest operations scale for batch updates", () => {
    const originalLocalStorage = (globalThis as any).localStorage;
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
        removeItem: (key: string) => data.delete(key),
      },
      configurable: true,
    });

    const doc = new Y.Doc();
    const manifest = new FileManifest(doc);

    const entries: FileManifestEntry[] = Array.from({ length: 3000 }).map((_, i) => ({
      id: `file-${i}`,
      room: "room-a",
      filename: `file-${i}.pdf`,
      contentType: "application/pdf",
      sizeBytes: 1024 + i,
      contentHash: `hash-${i}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: "device-a",
    }));

    manifest.updateMyPresence(entries.slice(0, 10).map((entry) => entry.id));

    const start = nowMs();
    for (const entry of entries) {
      manifest.addFile(entry);
    }
    const all = manifest.getAllFiles();
    const available = manifest.isFileAvailable("file-0");
    const duration = nowMs() - start;

    expect(all.length).toBe(3000);
    expect(available).toBe(true);
    expect(duration).toBeLessThan(2500);

    if (typeof originalLocalStorage === "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as any).localStorage;
    } else {
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
      });
    }
  });
});
