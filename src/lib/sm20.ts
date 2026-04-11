/**
 * SM-20 Scheduler Core
 *
 * Native TypeScript implementation for the browser/PWA backend.
 * The Tauri backend uses a matching native Rust implementation under `src-tauri/src/algorithms/sm20.rs`.
 *
 * The interval-growth core is based on the reverse-engineered SM-20 V2 matrix prior from `sm20-re`.
 * The review-state update around that core is an app-level approximation so we can expose SM-20
 * as a first-class algorithm without claiming a bit-for-bit reproduction of SuperMemo's optimizer.
 */

export interface SM20State {
  version: 2;
  stability: number;
  difficulty: number;
  repetition: number;
  lapses: number;
  interval: number;
  last_quality: number;
}

export interface SM20ReviewResult {
  state: SM20State;
  interval_days: number;
  retrievability: number;
}

const STABILITY_POWER = 2.90396936502257;
const MIN_STABILITY = 0.7;
const MAX_STABILITY = 44530.0;

const V2 = {
  c1: 9.29,
  c2: 1.3,
  c3: 1.0,
  c4: -0.08,
  c5: -0.31,
  c6: 1.04,
  c7: 0.07,
  c8: -1.88,
  c9: 1.58,
  c10: 600.0,
} as const;

const DEFAULT_STATE: SM20State = {
  version: 2,
  stability: 1.0,
  difficulty: 0.3,
  repetition: 0,
  lapses: 0,
  interval: 1.0,
  last_quality: 0.75,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function parseSm20State(algorithmState?: string): SM20State {
  if (algorithmState) {
    try {
      const parsed = JSON.parse(algorithmState) as Partial<SM20State>;
      if (parsed && typeof parsed.stability === "number" && typeof parsed.difficulty === "number") {
        return {
          version: 2,
          stability: parsed.stability,
          difficulty: parsed.difficulty,
          repetition: parsed.repetition ?? 0,
          lapses: parsed.lapses ?? 0,
          interval: parsed.interval ?? Math.max(1.0, parsed.stability),
          last_quality: parsed.last_quality ?? 0.75,
        };
      }
    } catch {
      // Ignore malformed state and fall back to defaults.
    }
  }
  return { ...DEFAULT_STATE };
}

export function sm20Retrievability(stability: number, elapsedDays: number): number {
  if (!Number.isFinite(stability) || stability <= 0) {
    return 0;
  }
  const elapsed = Math.max(0, elapsedDays);
  return Math.pow(0.9, elapsed / stability);
}

function transformedStability(stability: number): number {
  return Math.pow(Math.max(0, stability - 1.0), STABILITY_POWER) + 2.0;
}

function computeIntervalGrowth(repFraction: number, stability: number, difficulty: number): number {
  const stabilityScale = V2.c2 + (V2.c1 - V2.c2) * (V2.c3 - repFraction);
  const repPower = V2.c4 + repFraction * (V2.c5 - V2.c4);
  const repFactor = Math.pow(transformedStability(stability), Math.max(0.001, repPower));
  const base = (stabilityScale - V2.c6) * repFactor + V2.c7;
  const penalty = Math.min(V2.c10, repFraction * V2.c8 + V2.c9);
  const exponent = -penalty * clamp(difficulty, 0.0, 1.0);
  return base * Math.pow(2.0, clamp(exponent, -38.0, 38.0));
}

function ratingToQuality(rating: number): number {
  switch (rating) {
    case 1:
      return 0.05;
    case 2:
      return 0.60;
    case 3:
      return 0.78;
    case 4:
      return 0.92;
    default:
      return 0.78;
  }
}

function successMultiplier(rating: number): number {
  switch (rating) {
    case 2:
      return 0.85;
    case 4:
      return 1.15;
    default:
      return 1.0;
  }
}

function nextDifficulty(currentDifficulty: number, quality: number): number {
  const updated = currentDifficulty + (0.7 - quality) * 0.18;
  return clamp(updated, 0.0, 1.0);
}

function lapseInterval(stability: number, lapses: number): number {
  const decayed = Math.max(0.5, stability * 0.35);
  return clamp(decayed / (1.0 + lapses * 0.15), 0.5, 3.0);
}

export function sm20Review(
  currentState: SM20State,
  rating: number,
  elapsedDays: number
): SM20ReviewResult {
  const state = parseSm20State(JSON.stringify(currentState));
  const quality = ratingToQuality(rating);
  const retrievability = sm20Retrievability(state.stability, elapsedDays);

  if (rating <= 1) {
    const lapses = state.lapses + 1;
    const intervalDays = lapseInterval(state.stability, lapses);
    const nextState: SM20State = {
      version: 2,
      stability: clamp(intervalDays, MIN_STABILITY, MAX_STABILITY),
      difficulty: nextDifficulty(state.difficulty, quality),
      repetition: 0,
      lapses,
      interval: intervalDays,
      last_quality: quality,
    };
    return {
      state: nextState,
      interval_days: intervalDays,
      retrievability,
    };
  }

  const repetition = clamp(state.repetition + 1, 1, 20);
  const repFraction = (repetition - 1) / 19.0;
  const growth = computeIntervalGrowth(repFraction, state.stability, state.difficulty);
  const intervalDays = clamp(
    Math.max(1.0, state.stability * growth * successMultiplier(rating)),
    1.0,
    MAX_STABILITY
  );

  const nextState: SM20State = {
    version: 2,
    stability: intervalDays,
    difficulty: nextDifficulty(state.difficulty, quality),
    repetition,
    lapses: state.lapses,
    interval: intervalDays,
    last_quality: quality,
  };

  return {
    state: nextState,
    interval_days: intervalDays,
    retrievability,
  };
}

export function sm20PreviewIntervals(
  currentState: SM20State,
  elapsedDays: number
): Record<"again" | "hard" | "good" | "easy", number> {
  return {
    again: sm20Review(currentState, 1, elapsedDays).interval_days,
    hard: sm20Review(currentState, 2, elapsedDays).interval_days,
    good: sm20Review(currentState, 3, elapsedDays).interval_days,
    easy: sm20Review(currentState, 4, elapsedDays).interval_days,
  };
}
