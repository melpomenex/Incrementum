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

const emitMock = (async () => {
  const m = await import("@tauri-apps/api/event");
  return m.emit as unknown as ReturnType<typeof vi.fn>;
})();

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

describe("transcribePodcastEpisodeWithGroq (mocked Groq + invoke)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    invokeCommandMock.mockClear();
    // Re-establish the implementation after mockClear (which resets it).
    invokeCommandMock.mockImplementation((cmd: string) => {
      if (cmd === "resolve_podcast_audio_url") return Promise.resolve("https://example.com/episode.mp3");
      return Promise.resolve(undefined);
    });
    (emitMock as any).mockClear?.();
    // Seed the Groq key in localStorage so the chunked path (which reads it
    // directly, not via the mocked settings store) finds a key.
    localStorage.setItem(
      "incrementum-settings",
      JSON.stringify({ state: { settings: { audioTranscription: { groq: { apiKey: "gsk_test_key_for_unit_test_only", model: "whisper-large-v3-turbo" } } } } }),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("posts to Groq with url + verbose_json + word granularity, then persists segments with word timings", async () => {
    let capturedBody: FormData | null = null;
    let capturedUrl = "";
    let capturedAuth = "";
    global.fetch = vi.fn(async (url: any, init: any) => {
      // Size-probe: a Range GET. Respond with a small total so the single-URL
      // path is taken (not chunking).
      if (init?.headers?.Range === "bytes=0-0") {
        return new Response(new Uint8Array([0]), {
          status: 206,
          headers: { "Content-Range": "bytes 0-0/1000" },
        });
      }
      capturedUrl = String(url);
      capturedAuth = init.headers?.Authorization ?? "";
      capturedBody = init.body as FormData;
      return new Response(
        JSON.stringify({
          text: "Hello world. Good morning.",
          duration: 4,
          segments: [
            { id: 0, start: 0, end: 2, text: "Hello world. " },
            { id: 1, start: 2, end: 4, text: "Good morning." },
          ],
          words: [
            { word: "Hello", start: 0.1, end: 0.5 },
            { word: "world.", start: 0.6, end: 1.0 },
            { word: "Good", start: 2.1, end: 2.4 },
            { word: "morning.", start: 2.5, end: 3.0 },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    await transcribePodcastEpisodeWithGroq(
      "ep-1",
      "https://example.com/episode.mp3",
      "en",
    );

    // 1. The Groq request was correct.
    expect(capturedUrl).toContain("/audio/transcriptions");
    expect(capturedAuth).toBe("Bearer gsk_test_key_for_unit_test_only");
    expect(capturedBody!.get("url")).toBe("https://example.com/episode.mp3");
    expect(capturedBody!.get("response_format")).toBe("verbose_json");
    // Word-level granularity was requested (this is what unlocks karaoke highlighting).
    const granularities = capturedBody!.getAll("timestamp_granularities[]");
    expect(granularities).toEqual(expect.arrayContaining(["segment", "word"]));

    // 2. save_podcast_transcript_segments was invoked with the right shape.
    const saveCall = invokeCommandMock.mock.calls.find(
      (c) => c[0] === "save_podcast_transcript_segments",
    );
    expect(saveCall, "save_podcast_transcript_segments was invoked").toBeTruthy();
    const { episodeId, segments } = saveCall![1] as any;
    expect(episodeId).toBe("ep-1");
    expect(segments).toHaveLength(2);
    // Segment 0 carries the two words (midpoint in [0,2]).
    expect(segments[0].start_ms).toBe(0);
    expect(segments[0].end_ms).toBe(2000);
    expect(segments[0].text).toBe("Hello world.");
    expect(segments[0].word_timings_json).not.toBeNull();
    const seg0Words = JSON.parse(segments[0].word_timings_json);
    expect(seg0Words.map((w: any) => w.word)).toEqual(["Hello", "world."]);
    // Segment 1 carries the other two words.
    const seg1Words = JSON.parse(segments[1].word_timings_json);
    expect(seg1Words.map((w: any) => w.word)).toEqual(["Good", "morning."]);
  });

  it("throws and emits a transcription-error event when Groq returns an error", async () => {
    global.fetch = vi.fn(async (_url: any, init: any) => {
      // Size-probe: small total → single-URL path → reaches the 401 Groq call.
      if (init?.headers?.Range === "bytes=0-0") {
        return new Response(new Uint8Array([0]), {
          status: 206,
          headers: { "Content-Range": "bytes 0-0/1000" },
        });
      }
      return new Response(JSON.stringify({ error: { message: "Invalid API key" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await expect(
      transcribePodcastEpisodeWithGroq("ep-2", "https://example.com/bad.mp3", "en"),
    ).rejects.toThrow(/Invalid API key|Transcription failed/);

    // No persistence should have happened.
    const saveCall = invokeCommandMock.mock.calls.find(
      (c) => c[0] === "save_podcast_transcript_segments",
    );
    expect(saveCall).toBeUndefined();
  });
});
