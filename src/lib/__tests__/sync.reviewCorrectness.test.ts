/**
 * Review-history merge correctness tests.
 *
 * These verify the invariants that make multi-device flashcard sync correct,
 * per the design (openspec Decision 3 + Phase 4):
 *   1. The same review event replayed by one device collapses to one id
 *      (idempotency under reconnect/replay).
 *   2. Two devices reviewing the SAME card produce DIFFERENT ids (both count).
 *   3. Two reviews on different devices within the same millisecond do not
 *      collide (device_id is the tiebreaker).
 *   4. The HLC sync clock is strictly monotonic within a device (no ties), and
 *      the comparison helper orders values correctly.
 *
 * These are pure unit tests over `deterministicReviewId` and the clock helpers
 * — they don't need a live Yjs doc. The full two-client convergence harness
 * (Phase 8 acceptance test) exercises these invariants end-to-end.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  deterministicReviewId,
} from "../sync/entities/flashcards";
import {
  nowHLC,
  compareClock,
  isNewer,
  __syncClockTest,
} from "../sync/syncClock";
import { isTombstone } from "../sync/tombstone";

beforeEach(() => {
  __syncClockTest.reset();
});

describe("deterministicReviewId — multi-device review merge", () => {
  it("is idempotent: the same event produces the same id", async () => {
    const id1 = await deterministicReviewId("card-1", 1_700_000_000_000, "device-A");
    const id2 = await deterministicReviewId("card-1", 1_700_000_000_000, "device-A");
    expect(id1).toBe(id2);
  });

  it("counts both devices: same card + same time but different device → different ids", async () => {
    const idA = await deterministicReviewId("card-1", 1_700_000_000_000, "device-A");
    const idB = await deterministicReviewId("card-1", 1_700_000_000_000, "device-B");
    expect(idA).not.toBe(idB);
  });

  it("distinguishes sequential reviews on the same card by the same device", async () => {
    const id1 = await deterministicReviewId("card-1", 1_700_000_000_000, "device-A");
    const id2 = await deterministicReviewId("card-1", 1_700_000_001_000, "device-A");
    expect(id1).not.toBe(id2);
  });

  it("distinguishes the same review across different cards", async () => {
    const id1 = await deterministicReviewId("card-1", 1_700_000_000_000, "device-A");
    const id2 = await deterministicReviewId("card-2", 1_700_000_000_000, "device-A");
    expect(id1).not.toBe(id2);
  });

  it("produces stable-length hex ids (SHA-1 = 40 chars when WebCrypto available)", async () => {
    const id = await deterministicReviewId("card-1", 1_700_000_000_000, "device-A");
    // Either the full 40-char SHA-1 hex (WebCrypto) or the 16-char fallback.
    expect(id.length === 40 || id.length === 16).toBe(true);
    expect(/^[0-9a-f]+$/.test(id)).toBe(true);
  });
});

describe("nowHLC — monotonic sync clock", () => {
  it("is strictly increasing across sequential calls", () => {
    const a = nowHLC();
    const b = nowHLC();
    const c = nowHLC();
    expect(compareClock(a, b)).toBeLessThan(0);
    expect(compareClock(b, c)).toBeLessThan(0);
    expect(compareClock(a, c)).toBeLessThan(0);
  });

  it("stays monotonic even when called within the same millisecond", () => {
    // Freeze Date.now so every call shares the same wall ms — the only thing
    // keeping order is the per-process counter.
    const realNow = Date.now;
    const fixed = 1_700_000_000_000;
    Date.now = () => fixed;
    try {
      const ids = Array.from({ length: 100 }, () => nowHLC());
      for (let i = 1; i < ids.length; i++) {
        expect(isNewer(ids[i], ids[i - 1])).toBe(true);
      }
    } finally {
      Date.now = realNow;
    }
  });

  it("isNewer returns false for equal values and handles nulls", () => {
    const a = nowHLC();
    expect(isNewer(a, a)).toBe(false);
    expect(isNewer(a, null)).toBe(true);
    expect(isNewer(null, a)).toBe(false);
  });

  it("compares HLC and ISO strings by wall time without throwing", () => {
    const hlc = nowHLC();
    const iso = new Date().toISOString();
    // Same epoch second ballpark → should not throw and should return a number.
    expect(typeof compareClock(hlc, iso)).toBe("number");
    expect(typeof compareClock(iso, hlc)).toBe("number");
  });
});

describe("tombstone detection", () => {
  it("recognizes a tombstone marker", () => {
    expect(isTombstone({ _deleted: true, deletedAt: "x" })).toBe(true);
  });

  it("rejects a live row", () => {
    expect(isTombstone({ id: "a", updated_at: "1" })).toBe(false);
    expect(isTombstone(null)).toBe(false);
    expect(isTombstone(undefined)).toBe(false);
    expect(isTombstone({ _deleted: false })).toBe(false);
  });
});

/**
 * The scenario these primitives exist to make correct:
 *
 *   Device A reviews card-1 at t=100 (rating Good).
 *   Device B reviews card-1 at t=200 (rating Again).
 *   Both devices go offline, then reconnect.
 *
 * Correct merge requires:
 *   - both reviews present in the log (B's Again must count as a lapse),
 *   - exactly two entries (no duplication from replay),
 *   - card state reflects the chronologically latest review (B's).
 *
 * The deterministic-id + HLC primitives above are what guarantee this in the
 * real two-client harness (Phase 8). Here we assert the id-level consequence.
 */
describe("the paramount scenario: same card reviewed on two devices", () => {
  it("produces two distinct, replay-stable ids", async () => {
    const aFirst = await deterministicReviewId("card-1", 100, "device-A");
    const aReplay = await deterministicReviewId("card-1", 100, "device-A"); // reconnect replay
    const bReview = await deterministicReviewId("card-1", 200, "device-B");

    const uniqueIds = new Set([aFirst, aReplay, bReview]);
    expect(uniqueIds.size).toBe(2); // A's replay collapses; B's is distinct
  });
});
