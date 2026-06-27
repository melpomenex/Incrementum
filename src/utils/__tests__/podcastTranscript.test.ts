/**
 * Unit tests for the podcast word-synced-transcript logic:
 *   - findActiveWordIndex: which word is highlighted at a given playback time
 *   - mapGroqResponseToSegments: Groq verbose_json → DB segments with word timings
 *
 * These are the pure, deterministic cores of the karaoke-style word highlighting
 * and the Groq transcription persistence path. The React rendering and the live
 * HTTP/network calls are exercised separately; here we prove the timing math.
 */
import { describe, it, expect } from "vitest";
import { findActiveWordIndex } from "../../components/viewer/AudiobookViewer";
import { mapGroqResponseToSegments } from "../../api/podcast";

describe("findActiveWordIndex", () => {
  const timings = [
    { word: "Hello", start_ms: 1000, end_ms: 1500 },
    { word: "world", start_ms: 1600, end_ms: 2100 },
    { word: "today", start_ms: 2200, end_ms: 2700 },
  ];

  it("returns the word whose [start,end] contains the current time", () => {
    expect(findActiveWordIndex(timings, 1.2)).toBe(0); // 1200ms → "Hello"
    expect(findActiveWordIndex(timings, 1.9)).toBe(1); // 1900ms → "world"
    expect(findActiveWordIndex(timings, 2.4)).toBe(2); // 2400ms → "today"
  });

  it("keeps a word highlighted through the sticky tolerance gap, but hands off when the next word starts", () => {
    // timings: Hello[1000-1500] world[1600-2100] today[2200-2700]
    // Gap between "Hello" (ends 1500) and "world" (starts 1600): at 1.55s
    // (1550ms) we're past Hello's end but within the +200ms tolerance AND before
    // world's start (1600), so "Hello" stays highlighted rather than flickering.
    expect(findActiveWordIndex(timings, 1.55)).toBe(0);
    // At 1.6s "world" starts — tolerance is capped at nextStart (1600), so we
    // hand off to "world" even though we're still within Hello's +200ms window.
    expect(findActiveWordIndex(timings, 1.6)).toBe(1);
    // At 1.8s we're solidly in "world".
    expect(findActiveWordIndex(timings, 1.8)).toBe(1);
  });

  it("hands off cleanly between back-to-back words (no gap, tolerance capped)", () => {
    // Words with NO gap between them: the +200ms tolerance must not let word 0
    // swallow word 1. This mirrors real Groq output (e.g. "Hey,"[300-580]
    // "it's"[580-680]) where word midpoints would otherwise land in the prior
    // word's tolerance window.
    const backToBack = [
      { word: "Hey,", start_ms: 300, end_ms: 580 },
      { word: "it's", start_ms: 580, end_ms: 680 },
      { word: "Tucker", start_ms: 680, end_ms: 900 },
    ];
    // Midpoint of "it's" is 630ms — within "Hey,"'s +200ms (780) but AT
    // "it's"'s start (580), so the cap hands off to "it's".
    expect(findActiveWordIndex(backToBack, 0.63)).toBe(1);
    expect(findActiveWordIndex(backToBack, 0.79)).toBe(2); // 790ms in "Tucker"'s window
  });

  it("keeps the last word highlighted when playback is past its end (still in segment)", () => {
    // At 3.0s we're past "today"'s end (2700) — keep the last word lit so the
    // highlight doesn't blank out mid-sentence before the segment boundary.
    expect(findActiveWordIndex(timings, 3.0)).toBe(2);
  });

  it("returns -1 before the first word starts", () => {
    expect(findActiveWordIndex(timings, 0.5)).toBe(-1); // 500ms, before "Hello"
  });

  it("returns -1 for empty timings", () => {
    expect(findActiveWordIndex([], 5.0)).toBe(-1);
  });

  it("handles a single word", () => {
    const single = [{ word: "only", start_ms: 0, end_ms: 1000 }];
    expect(findActiveWordIndex(single, 0.5)).toBe(0);
    expect(findActiveWordIndex(single, 2.0)).toBe(0); // past end → keep last
  });
});

describe("mapGroqResponseToSegments", () => {
  it("converts Groq segment seconds to ms and assigns words by midpoint", () => {
    const result = mapGroqResponseToSegments({
      segments: [
        { start: 0, end: 2, text: "Hello world. " },
        { start: 2, end: 4, text: "Good morning." },
      ],
      words: [
        { word: "Hello", start: 0.1, end: 0.5 },   // mid 0.3 → seg 0
        { word: "world.", start: 0.6, end: 1.0 },    // mid 0.8 → seg 0
        { word: "Good", start: 2.1, end: 2.4 },      // mid 2.25 → seg 1
        { word: "morning.", start: 2.5, end: 3.0 },  // mid 2.75 → seg 1
      ],
    });

    expect(result).toHaveLength(2);
    // Segment 0: 0–2000ms, trimmed text, two words.
    expect(result[0].start_ms).toBe(0);
    expect(result[0].end_ms).toBe(2000);
    expect(result[0].text).toBe("Hello world.");
    const seg0Words = JSON.parse(result[0].word_timings_json!);
    expect(seg0Words).toHaveLength(2);
    expect(seg0Words[0]).toMatchObject({ word: "Hello", start_ms: 100, end_ms: 500 });

    // Segment 1: 2000–4000ms, two words.
    expect(result[1].start_ms).toBe(2000);
    const seg1Words = JSON.parse(result[1].word_timings_json!);
    expect(seg1Words).toHaveLength(2);
    expect(seg1Words.map((w: any) => w.word)).toEqual(["Good", "morning."]);
  });

  it("produces null word_timings_json when no words are present", () => {
    const result = mapGroqResponseToSegments({
      segments: [{ start: 0, end: 1, text: "No words." }],
      words: [],
    });
    expect(result[0].word_timings_json).toBeNull();
  });

  it("round-trips: words survive JSON parse with ms timings", () => {
    const result = mapGroqResponseToSegments({
      segments: [{ start: 1, end: 3, text: "test phrase" }],
      words: [
        { word: "test", start: 1.234, end: 1.567 },
        { word: "phrase", start: 1.6, end: 2.0 },
      ],
    });
    const words = JSON.parse(result[0].word_timings_json!);
    // Seconds → ms rounding preserved.
    expect(words[0].start_ms).toBe(1234);
    expect(words[0].end_ms).toBe(1567);
  });

  it("handles a word whose midpoint falls exactly on a segment boundary", () => {
    // Word midpoint exactly at seg0.end (2.0): 2.0 >= 2.0 → goes to seg1, not seg0.
    const result = mapGroqResponseToSegments({
      segments: [
        { start: 0, end: 2, text: "first" },
        { start: 2, end: 4, text: "second" },
      ],
      words: [{ word: "boundary", start: 1.8, end: 2.2 }], // mid = 2.0
    });
    const seg0Words = result[0].word_timings_json ? JSON.parse(result[0].word_timings_json) : [];
    const seg1Words = result[1].word_timings_json ? JSON.parse(result[1].word_timings_json) : [];
    expect(seg0Words).toHaveLength(0);
    expect(seg1Words).toHaveLength(1);
  });
});
