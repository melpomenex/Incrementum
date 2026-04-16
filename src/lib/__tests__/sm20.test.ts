import { describe, expect, test } from "vitest";
import {
  parseSm20State,
  sm20PreviewIntervals,
  sm20Retrievability,
  sm20Review,
  sm20RecordReview,
  fsrsReviewKernel,
  fsrsInitItem,
} from "../sm20";

describe("SM-20 scheduler", () => {
  test("parses default state", () => {
    const state = parseSm20State();
    expect(state.stability).toBe(1.0);
    expect(state.difficulty).toBe(0.3);
    expect(state.repetition).toBe(0);
  });

  test("uses 90 percent forgetting curve", () => {
    expect(sm20Retrievability(10, 10)).toBeCloseTo(0.9, 10);
  });

  test("good review grows interval", () => {
    const state = parseSm20State(JSON.stringify({
      stability: 2.0,
      difficulty: 0.3,
      repetition: 2,
      lapses: 0,
      interval: 2.0,
    }));
    const result = sm20Review(state, 3, 2.0);
    expect(result.interval_days).toBeGreaterThan(state.interval);
    expect(result.state.repetition).toBe(3);
  });

  test("again review triggers lapse path", () => {
    const state = parseSm20State(JSON.stringify({
      stability: 8.0,
      difficulty: 0.3,
      repetition: 5,
      lapses: 0,
      interval: 8.0,
    }));
    const result = sm20Review(state, 1, 8.0);
    expect(result.interval_days).toBeLessThan(state.interval);
    expect(result.state.lapses).toBe(1);
    expect(result.state.repetition).toBe(0);
  });

  test("preview intervals remain ordered", () => {
    const preview = sm20PreviewIntervals(parseSm20State(), 0);
    expect(preview.again).toBeLessThan(preview.hard);
    expect(preview.hard).toBeLessThan(preview.good);
    expect(preview.good).toBeLessThan(preview.easy);
  });

  test("record review incremental average", () => {
    const intervalMatrix = new Float64Array(9261);
    const countMatrix = new Uint32Array(9261);
    sm20RecordReview(5.0, 0.3, 3, 3.0, intervalMatrix, countMatrix);
    sm20RecordReview(5.0, 0.3, 3, 5.0, intervalMatrix, countMatrix);
    // After recording 3.0 then 5.0 for the same cell: count=2, interval=(3*1+5)/2=4.0
    let foundCell = false;
    for (let i = 0; i < 9261; i++) {
      if (countMatrix[i] > 0) {
        expect(countMatrix[i]).toBe(2);
        expect(intervalMatrix[i]).toBeCloseTo(4.0, 10);
        foundCell = true;
      }
    }
    expect(foundCell).toBe(true);
  });
});

describe("SM-20 FSRS-family branch", () => {
  test("review kernel lapse path", () => {
    const [sNew, dNew, interval, easiness] = fsrsReviewKernel(5.0, 0.3, 5.0, 1);
    expect(sNew).toBeCloseTo(8.25553717907111, 8);
    expect(dNew).toBeCloseTo(1.0, 8);
    expect(interval).toBeCloseTo(8.25553717907111, 8);
    expect(easiness).toBeCloseTo(1.65110743581422, 8);
  });

  test("review kernel recall path", () => {
    const [sNew, dNew, interval, easiness] = fsrsReviewKernel(5.0, 0.3, 3.0, 4);
    expect(sNew).toBeCloseTo(9.44504365807168, 8);
    expect(dNew).toBeCloseTo(1.0, 8);
    expect(interval).toBeCloseTo(9.44504365807168, 8);
    expect(easiness).toBeCloseTo(1.88900873161434, 8);
  });

  test("init item grade 3 no flag", () => {
    const state = fsrsInitItem(3, 1.0, false);
    expect(state.algorithm_branch).toBe(1);
    expect(state.multiplier).toBeCloseTo(3.0);
    expect(state.retrov).toBe(state.difficulty);
  });

  test("init item grade 5 with flag", () => {
    const state = fsrsInitItem(5, 2.0, true);
    expect(state.algorithm_branch).toBe(1);
    expect(state.multiplier).toBeCloseTo(0.5);
  });

  test("FSRS review dispatch via sm20Review", () => {
    const fsrsState = {
      version: 2,
      stability: 5.0,
      difficulty: 0.3,
      repetition: 3,
      lapses: 0,
      interval: 5.0,
      last_quality: 0.78,
      algorithm_branch: 1,
      retrov: 0.3,
      s_factor: 1.0,
      multiplier: 1.0,
    };
    const result = sm20Review(fsrsState, 4, 3.0);
    expect(result.state.algorithm_branch).toBe(1);
    expect(result.state.stability).toBeCloseTo(9.44504365807168, 8);
  });

  test("backward compat: parse old state without FSRS fields", () => {
    const state = parseSm20State(JSON.stringify({
      version: 2,
      stability: 5.0,
      difficulty: 0.3,
      repetition: 3,
      lapses: 0,
      interval: 5.0,
      last_quality: 0.78,
    }));
    expect(state.algorithm_branch).toBe(0);
    expect(state.s_factor).toBe(1.0);
    expect(state.multiplier).toBe(1.0);
    expect(state.retrov).toBe(0.3);
  });
});
