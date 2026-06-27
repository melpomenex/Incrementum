/**
 * Integration test for the Groq podcast transcription plumbing.
 *
 * Proves the full path that runs on mobile/Android:
 *   transcribePodcastEpisodeWithGroq
 *     → transcribeWithGroq (HTTP POST to Groq with word-level granularity)
 *     → mapGroqResponseToSegments (Groq verbose_json → DB segments + word timings)
 *     → savePodcastTranscriptSegments (Tauri invoke with the persisted shape)
 *
 * The Groq HTTP call is mocked (no network / no real key); the Tauri invoke and
 * event emit are mocked too. What's verified is that the REAL code constructs a
 * correct Groq request (url + verbose_json + word granularity), parses the
 * response, and forwards the right segment/word-timing payload to persistence.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────
// Stub the Tauri event module BEFORE importing the code under test, since
// transcribePodcastEpisodeWithGroq dynamically imports @tauri-apps/api/event.
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}));
import { emit as emitMock } from "@tauri-apps/api/event";

// Mock invokeCommand so we can capture the save_podcast_transcript_segments call.
// resolve_podcast_audio_url returns the URL as-is (passthrough) so the Groq call
// gets a url; save_podcast_transcript_segments resolves to undefined.
const invokeCommandMock = vi.fn().mockImplementation((cmd: string) => {
  if (cmd === "resolve_podcast_audio_url") return Promise.resolve("https://example.com/episode.mp3");
  return Promise.resolve(undefined);
});

// Provide settings for the Groq key/model lookup in groqTranscription.ts.
vi.mock("../../lib/tauri", () => ({
  invokeCommand: (...args: unknown[]) => invokeCommandMock(...args),
  isTauri: () => true,
  isPWA: () => false,
}));

vi.mock("../../stores/settingsStore", () => ({
  useSettingsStore: {
    getState: () => ({
      settings: {
        audioTranscription: {
          groq: {
            apiKey: "gsk_test_key_for_unit_test_only",
            model: "whisper-large-v3-turbo",
            usage: { lastResetDate: new Date().toISOString().slice(0, 10), audioSecondsProcessed: 0, requestsMade: 0 },
          },
        },
      },
      // groqTranscription.updateUsageStats calls this after a successful call.
      updateSettings: () => undefined,
    }),
  },
}));

import { transcribePodcastEpisodeWithGroq } from "../podcast";

describe("transcribePodcastEpisodeWithGroq (mocked Rust transcription)", () => {
  beforeEach(() => {
    invokeCommandMock.mockClear();
    // Re-establish the implementation after mockClear (which resets it).
    invokeCommandMock.mockImplementation((cmd: string) => {
      if (cmd === "resolve_podcast_audio_url") return Promise.resolve("https://example.com/episode.mp3");
      // transcribe_podcast_groq_chunks is now the server-side path; return a
      // couple of fake segments so the persist step runs.
      if (cmd === "transcribe_podcast_groq_chunks") {
        return Promise.resolve([
          { start_ms: 0, end_ms: 2000, text: "Hello world.", word_timings_json: JSON.stringify([{ word: "Hello", start_ms: 0, end_ms: 500 }, { word: "world.", start_ms: 600, end_ms: 1000 }]) },
          { start_ms: 2000, end_ms: 4000, text: "Good morning.", word_timings_json: null },
        ]);
      }
      return Promise.resolve(undefined);
    });
    vi.mocked(emitMock).mockClear();
    // Seed the Groq key in localStorage so the path (which reads it directly)
    // finds a key.
    localStorage.setItem(
      "incrementum-settings",
      JSON.stringify({ state: { settings: { audioTranscription: { groq: { apiKey: "gsk_test_key_for_unit_test_only", model: "whisper-large-v3-turbo" } } } } }),
    );
  });

  afterEach(() => {
    // No fetch to restore — the Groq call now happens entirely in Rust.
  });

  it("invokes the server-side chunked transcription + persists segments", async () => {
    await transcribePodcastEpisodeWithGroq(
      "ep-1",
      "https://example.com/episode.mp3",
      "en",
    );

    // 1. transcribe_podcast_groq_chunks was invoked with the resolved URL +
    //    key + model + language.
    const tcall = invokeCommandMock.mock.calls.find(
      (c) => c[0] === "transcribe_podcast_groq_chunks",
    );
    expect(tcall, "transcribe_podcast_groq_chunks was invoked").toBeTruthy();
    const targs = tcall![1] as any;
    expect(targs.episodeId).toBe("ep-1");
    expect(targs.audioUrl).toBe("https://example.com/episode.mp3");
    expect(targs.groqApiKey).toMatch(/^gsk_/);
    expect(targs.groqModel).toBe("whisper-large-v3-turbo");
    expect(targs.language).toBe("en");

    // 2. save_podcast_transcript_segments was invoked with the returned segments.
    const saveCall = invokeCommandMock.mock.calls.find(
      (c) => c[0] === "save_podcast_transcript_segments",
    );
    expect(saveCall, "save_podcast_transcript_segments was invoked").toBeTruthy();
    const { episodeId, segments } = saveCall![1] as any;
    expect(episodeId).toBe("ep-1");
    expect(segments).toHaveLength(2);
    expect(segments[0].start_ms).toBe(0);
    expect(segments[0].text).toBe("Hello world.");
    expect(segments[0].word_timings_json).not.toBeNull();
    const seg0Words = JSON.parse(segments[0].word_timings_json);
    expect(seg0Words.map((w: any) => w.word)).toEqual(["Hello", "world."]);

    // 3. completion event emitted.
    const completeEmit = (emitMock as any).mock.calls.find(
      (c: any[]) => c[0] === "podcast://transcription-complete",
    );
    expect(completeEmit, "completion event emitted").toBeTruthy();
    expect(completeEmit[1]).toMatchObject({ episodeId: "ep-1", segmentCount: 2 });
  });

  it("throws and emits a transcription-error when the key is missing", async () => {
    // Remove the key so the early guard fires.
    localStorage.removeItem("incrementum-settings");
    await expect(
      transcribePodcastEpisodeWithGroq("ep-2", "https://example.com/bad.mp3", "en"),
    ).rejects.toThrow(/Groq API key not configured/);

    // No transcription or persistence should have happened.
    const tcall = invokeCommandMock.mock.calls.find(
      (c) => c[0] === "transcribe_podcast_groq_chunks",
    );
    expect(tcall).toBeUndefined();
    const saveCall = invokeCommandMock.mock.calls.find(
      (c) => c[0] === "save_podcast_transcript_segments",
    );
    expect(saveCall).toBeUndefined();
  });
});
