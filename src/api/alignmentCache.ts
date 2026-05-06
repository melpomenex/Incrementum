import { invokeCommand, isTauri } from "../lib/tauri";
import type { AlignmentResult } from "../types/alignment";

function cacheKey(audioDocId: string, epubDocId: string): string {
  return `incrementum:alignment:${audioDocId}:${epubDocId}`;
}

export async function cacheAlignment(result: AlignmentResult): Promise<void> {
  const json = JSON.stringify(result);
  const key = cacheKey(result.audioDocId, result.epubDocId);

  if (isTauri()) {
    try {
      const { appDataDir } = await import("@tauri-apps/api/path");
      const dir = await appDataDir();
      await invokeCommand("write_file", {
        path: `${dir}alignments/${result.audioDocId}_${result.epubDocId}.json`,
        contents: json,
      });
    } catch {
      localStorage.setItem(key, json);
    }
  } else {
    localStorage.setItem(key, json);
  }
}

export async function getCachedAlignment(
  audioDocId: string,
  epubDocId: string
): Promise<AlignmentResult | null> {
  const key = cacheKey(audioDocId, epubDocId);

  if (isTauri()) {
    try {
      const { appDataDir } = await import("@tauri-apps/api/path");
      const dir = await appDataDir();
      const contents = await invokeCommand<string>("read_file", {
        path: `${dir}alignments/${audioDocId}_${epubDocId}.json`,
      });
      return JSON.parse(contents) as AlignmentResult;
    } catch {
      // fall through to localStorage
    }
  }

  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored) as AlignmentResult;
    } catch {
      return null;
    }
  }

  return null;
}
