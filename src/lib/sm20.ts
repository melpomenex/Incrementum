/**
 * SM-20 Scheduler Core
 *
 * Line-by-line translation of `sm20_reference.py`, itself reverse-engineered from
 * sm20.exe via Ghidra (75 functions, 44K fully decompiled). All three algorithm
 * versions (V2/V4/V6) and the Bayesian smoothing core are included.
 *
 * Native TypeScript implementation for the browser/PWA backend.
 * The Tauri backend uses a matching native Rust implementation under `src-tauri/src/algorithms/sm20.rs`.
 */

export interface SM20State {
  version: number;
  stability: number;
  difficulty: number;
  repetition: number;
  lapses: number;
  interval: number;
  last_quality: number;
  algorithm_branch?: number;
  retrov?: number;
  s_factor?: number;
  multiplier?: number;
}

export interface SM20ReviewResult {
  state: SM20State;
  interval_days: number;
  retrievability: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STABILITY_POWER = 2.90396936502257;
const STABILITY_LOWER = -1.0;
const STABILITY_CAP = 0.7;
const STABILITY_MAX = 44530.0;

/** --- V2 Formula constants (FUN_00ccf070) --- */
const V2_STABILITY_SCALE_MAX = 9.29;
const V2_STABILITY_SCALE_MIN = 1.3;
const V2_ANCHOR = 1.0;
const V2_REP_POWER_OFFSET = -0.08;
const V2_REP_POWER_COEFF = -0.31;
const V2_BASE_OFFSET = 1.04;
const V2_BASE_BIAS = 0.07;
const V2_PENALTY_SLOPE = -1.88;
const V2_PENALTY_INTERCEPT = 1.58;
const V2_PENALTY_CLAMP = 600.0;

/** --- Initial Interval constants (FUN_00ce1900) --- */
const INIT_STABILITY_SCALE_MAX = 15.0;
const INIT_STABILITY_SCALE_MIN = 3.0;
const INIT_ANCHOR = 1.0;
const INIT_REP_POWER_OFFSET = -0.08;
const INIT_REP_POWER_COEFF = -0.35;
const INIT_BASE_SUB = 1.0;
const INIT_BASE_ADD = 1.0;
const INIT_PENALTY_SLOPE = -2.0;
const INIT_PENALTY_INTERCEPT = 2.25;
const INIT_PENALTY_CLAMP = 600.0;

/** --- Bayesian Core constants (FUN_00ce1250) --- */
const BAYES_PRIOR_WEIGHT = 500.0;
const BAYES_TARGET_WEIGHT_SCALE = 10.0;
const BAYES_NEIGHBOR_WEIGHT_DENOM = 1000.0;
const BAYES_CUBE_WEIGHT = 3.0;
const BAYES_NEUTRAL = 1.0;

/** --- Rounding thresholds (FUN_00ce8dd0) --- */
const ROUND_WIDE_UPPER = 20.0;
const ROUND_WIDE_LOWER = 0.8;
const ROUND_NARROW_UPPER = 2.0;
const ROUND_NARROW_LOWER = 0.5;

/** --- U-Factor Table (20 values) --- */
const UFACTOR: readonly number[] = [
  13.822076, 8.212571, 6.056511, 4.879609, 4.126662, 3.598557, 3.205138, 2.899285, 2.653822,
  2.451912, 2.282528, 2.138131, 2.013379, 1.904376, 1.808207, 1.722649, 1.645970, 1.576804,
  1.514055, 1.456836,
];

/** Matrix dimensions */
const MATRIX_DIM = 21;
const MATRIX_STRIDE_R = MATRIX_DIM * MATRIX_DIM; // 441
const MATRIX_STRIDE_S = MATRIX_DIM; // 21
const MATRIX_SIZE = 9261;

// =============================================================================
// FSRS-FAMILY BRANCH CONSTANTS
// =============================================================================

/** 35 FSRS-family parameters extracted from runtime memory (PTR_DAT_01125c00). */
const FSRS_PARAMS: readonly number[] = [
  // Expert 1 (power-law) parameters
  0.9286298950420208,        // [0]  power-law base
  347.85204578386566,        // [1]  time denominator for weight
  0.30270230764837086,       // [2]  stability denominator for weight
  // Expert 2/3 weight params
  0.4078726801204931,        // [3]  expert 2 weight param
  767.8438603670941,         // [4]  expert 3 weight param
  // Initial difficulty per grade (0-5)
  7.894742385544259,         // [5]
  4.08242569493503,          // [6]
  1.996431220980246,         // [7]
  9.170585471775675,         // [8]
  1.1425608073008684,        // [9]
  17.65771045770738,         // [10]
  // Initial stability per grade (0-5, plus 2 extra)
  77.77877780253718,         // [11]
  0.5921926894783989,        // [12]
  0.6895479373487655,        // [13]
  0.6472785530963361,        // [14]
  0.4208423230793679,        // [15]
  0.5186353666458963,        // [16]
  0.27244747048223983,       // [17]
  0.3261492383691367,        // [18]
  // Lapse stability (grade < 3)
  1.680034668443124,         // [19] lapse decay rate
  5.928185533585771,         // [20] lapse weight param
  2.0150955428514656,        // [21] lapse multiplier
  0.2555216135743039,        // [22] lapse retrov correction
  1.9926553104343092,        // [23] lapse retrov weight
  // Difficulty update
  95.04137758278812,         // [24] d decay param
  42.21989471200275,         // [25] d stability factor
  // Recall stability (grade >= 3)
  3.1089639864486682,        // [26] recall base factor
  1.3558071518966488,        // [27] recall stability param
  0.9250460852489478,        // [28] hard bonus base
  0.8538692150895362,        // [29] hard bonus weight
  0.9559110660552212,        // [30] hard bonus ratio
  -0.6915519353695037,       // [31] recall time exponent
  1.0037797256248404,        // [32] recall grade factor
  1.393910494789472,         // [33] recall base offset
  0.12374729387559685,       // [34] recall grade mult
];

// =============================================================================
// LOW-LEVEL HELPERS
// =============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function exp2Clamped(x: number): number {
  return Math.pow(2, clamp(x, -38, 38));
}

function sigmoidWeight(x: number, y: number): number {
  const s = x + y;
  return s === 0 ? 0 : x / s;
}

// =============================================================================
// FSRS-FAMILY EXPERT FUNCTIONS
// =============================================================================

/** FUN_00af8ac0: Expert 1 — power-law forgetting. */
function fsrsExpert1(t: number, s: number): number {
  const param1 = FSRS_PARAMS[0];
  if (!(0 < param1 && 0 < s)) return 0.0;
  const expPower = Math.pow(param1 / 0.9, 2);
  const ratio = s / (s + t);
  return s * Math.pow(ratio, expPower);
}

/** FUN_00af8bb0: Expert 2 — FSRS-style power-law forgetting.
 *  result = pow(t/S + 1, log2(0.9)) = (1 + t/S)^(-0.152)
 *  Bounded to [0,1] and decreasing — a proper forgetting curve.
 */
function fsrsExpert2(t: number, s: number): number {
  const tOverS = s > 0 ? t / s : 0;
  const shifted = tOverS + 1.0;
  if (!(0 < t && 0 < shifted)) return 0.0;
  // FUN_0040c140(0.9) / FUN_0040c140(2) = log2(0.9) / log2(2) = log2(0.9)
  return Math.pow(shifted, Math.log2(0.9)); // ≈ -0.152
}

/** FUN_00af8c90: Expert 3 — exponential forgetting. */
function fsrsExpert3(t: number, s: number): number {
  if (!(0 < t)) return 0.0;
  const ratio = s > 0 ? t / s : 0;
  return Math.pow(2, -Math.abs(ratio) * 0.1053605);
}

/** FUN_00af8d00: 3-expert weighted average → retrievability-like proxy A. */
function fsrsExpertMixture(t: number, s: number): number {
  const e1 = fsrsExpert1(t, s);
  const e2 = fsrsExpert2(t, s);
  const e3 = fsrsExpert3(t, s);

  const w1Time = 1.0 - sigmoidWeight(t, FSRS_PARAMS[1]);
  const w1Stab = sigmoidWeight(s, FSRS_PARAMS[2]);
  const w1 = (w1Time + w1Stab) / 2.0;

  const w2Time = 1.0 - sigmoidWeight(t, FSRS_PARAMS[1]);
  const w2Stab = sigmoidWeight(s, FSRS_PARAMS[3]);
  const w2 = (w2Time + w2Stab) / 2.0;

  const w3 = sigmoidWeight(t, FSRS_PARAMS[4]);

  const wSum = w1 + w2 + w3;
  if (wSum === 0) return 0.0;
  return (w1 * e1 + w2 * e2 + w3 * e3) / wSum;
}

// =============================================================================
// FSRS-FAMILY UPDATE FUNCTIONS
// =============================================================================

/** FUN_00af90f0: Update difficulty based on review outcome. */
function fsrsDifficultyUpdate(d: number, s: number, a: number, grade: number): number {
  const ratio = sigmoidWeight(s, FSRS_PARAMS[24]);
  const dTarget = grade > 2 ? 1.0 : 0.0;
  const dNew = ratio * d + (1.0 - ratio) * (d - (dTarget - a));
  return clamp(dNew, 0.0, 1.0);
}

/** FUN_00af9010: Stability update for lapse (grade < 3). */
function fsrsLapseStability(d: number, s: number, a: number): number {
  let sNew = (1.0 - d) * FSRS_PARAMS[19] + 1.0;
  const w = sigmoidWeight(s, FSRS_PARAMS[20]);
  sNew *= w * FSRS_PARAMS[21] + 1.0;
  const retrovSignal = 1.0 - a;
  const r = sigmoidWeight(retrovSignal, FSRS_PARAMS[22]);
  sNew *= r * FSRS_PARAMS[23] + 1.0;
  return sNew;
}

/** FUN_00af91f0: Stability update for successful recall (grade >= 3). */
function fsrsRecallStability(d: number, s: number, a: number, t: number, grade: number): number {
  const sMin = Math.max(s, t);

  const hardBonus = t < s
    ? FSRS_PARAMS[28] + FSRS_PARAMS[29] * sigmoidWeight(s > 0 ? t / s : 0, FSRS_PARAMS[30])
    : FSRS_PARAMS[28];

  const timeFactor = s > 0 ? Math.pow(s, FSRS_PARAMS[31]) : 1.0;
  const recallSignal = exp2Clamped(-(FSRS_PARAMS[32] * (1.0 - d) + FSRS_PARAMS[33]) * a);
  const gradeFactor = (grade - 4) * FSRS_PARAMS[34] + 1.0;
  const blend = FSRS_PARAMS[26] + (1.0 - d) * (FSRS_PARAMS[25] - FSRS_PARAMS[26]);

  return sMin * hardBonus * (FSRS_PARAMS[27] + blend * timeFactor * recallSignal * gradeFactor);
}

/** FUN_00af9420: Main FSRS review kernel. Returns [new_S, new_D, interval, easiness]. */
export function fsrsReviewKernel(s: number, d: number, t: number, grade: number): [number, number, number, number] {
  const a = fsrsExpertMixture(t, s);
  const dNew = fsrsDifficultyUpdate(d, s, a, grade);
  const sNew = grade < 3 ? fsrsLapseStability(dNew, s, a) : fsrsRecallStability(dNew, s, a, t, grade);
  const interval = sNew > 1.0 ? sNew : 1.0;
  const easiness = s > 1.0 ? sNew / s : 0.0;
  return [sNew, dNew, interval, easiness];
}

/** FUN_00ceb590: Initialize a new FSRS item. */
export function fsrsInitItem(grade: number, stability: number, flag: boolean): SM20State {
  const d = FSRS_PARAMS[Math.min(5 + grade, 10)];
  const sFactor = FSRS_PARAMS[Math.min(11 + grade, 18)];
  return {
    version: 2,
    stability,
    difficulty: d,
    repetition: 0,
    lapses: 0,
    interval: Math.max(1.0, stability),
    last_quality: 0.75,
    algorithm_branch: 1,
    retrov: d,
    s_factor: sFactor,
    multiplier: flag ? 0.5 : 3.0,
  };
}

// =============================================================================
// RETRIEVABILITY
// =============================================================================

export function sm20Retrievability(stability: number, elapsedDays: number): number {
  if (!Number.isFinite(stability) || stability <= 0) {
    return 0;
  }
  return Math.pow(0.9, Math.max(0, elapsedDays) / stability);
}

// =============================================================================
// INDEX CONVERSIONS
// =============================================================================

/** FUN_00cf7550: Validate and clamp stability. */
function stabilityPretransform(s: number): number {
  if (!Number.isFinite(s)) return STABILITY_MAX;
  if (s <= STABILITY_LOWER) return s;
  if (s < STABILITY_CAP) return STABILITY_CAP;
  if (s <= STABILITY_MAX) return s;
  return STABILITY_MAX;
}

/** FUN_00cf6fd0: floor(D * 19) + 1, result in [1, 10]. D<0 returns index 10. */
function difficultyToIndex(d: number): number {
  if (d < 0) return 10;
  return Math.min(10, Math.floor(d * 19) + 1);
}

/** FUN_00cf7330: Convert stability to matrix index in [1, 20]. */
function stabilityToIndex(s: number): number {
  const st = stabilityPretransform(s);
  const diff = Math.max(0, st - 2.0);
  const result = Math.pow(diff, 1.0 / STABILITY_POWER);
  return clamp(Math.floor(result) + 1, 1, 20);
}

/** FUN_00cf7420: Convert stability INDEX to transformed value. */
function stabilityToTransformed(sIdx: number): number {
  return Math.pow(sIdx - 1, STABILITY_POWER) + 2.0;
}

/** FUN_00cf7250: floor(exp2(R * 20)), clamped to [0, 20]. */
function retrievabilityToIndex(r: number): number {
  return clamp(Math.floor(Math.pow(2, r * 20)), 0, 20);
}

/** FUN_00cf73d0: D / 20.0 */
function difficultyToFraction(dIdx: number): number {
  return dIdx / 20.0;
}

/** FUN_00cf71c0: (R - 1) / 19 */
function repetitionToFraction(r: number): number {
  return (r - 1) / 19.0;
}

// =============================================================================
// ROUNDING
// =============================================================================

/** FUN_00ce8dd0: Clamp interval to threshold range. */
function applyRounding(interval: number, flags: number): number {
  const [upper, lower] = flags >= 4 || (flags & 2) !== 0
    ? [ROUND_WIDE_UPPER, ROUND_WIDE_LOWER]
    : [ROUND_NARROW_UPPER, ROUND_NARROW_LOWER];

  if (interval > upper) return upper;
  if (interval <= lower && Math.abs(interval - lower) > 1e-15) return lower;
  return interval;
}

// =============================================================================
// INTERVAL FORMULAS
// =============================================================================

/** FUN_00ccf070: Version 2 interval (SM-19 compatible). */
function intervalV2(repFraction: number, stabilityTransformed: number, difficultyFraction: number): number {
  const scale = V2_STABILITY_SCALE_MIN
    + (V2_STABILITY_SCALE_MAX - V2_STABILITY_SCALE_MIN) * (V2_ANCHOR - repFraction);
  const power = V2_REP_POWER_OFFSET + repFraction * (V2_REP_POWER_COEFF - V2_REP_POWER_OFFSET);
  const base = (scale - V2_BASE_OFFSET) * Math.pow(stabilityTransformed, power) + V2_BASE_BIAS;
  const penalty = Math.min(V2_PENALTY_CLAMP, repFraction * V2_PENALTY_SLOPE + V2_PENALTY_INTERCEPT);
  const exponent = -penalty * difficultyFraction;
  return base * exp2Clamped(exponent);
}

/** FUN_00ccd8e0: Version 4 interval (SM-20 proper). */
function intervalV4(p1: number, p2: number, p3: number, p4: number, p5: number, _p6: number, p7: number): number {
  return (p3 * p5 + 1.0) * (p1 * p7 + p2) + p4;
}

/** FUN_00ccfde0: Version 6 interval (FSRS-style). */
function intervalV6(p1: number, _p2: number, p3: number, p4: number, p5: number, p6: number): number {
  return p4 + p1 * exp2Clamped(p6) * exp2Clamped(-p3 * p5);
}

/** FUN_00ce1900: Bayesian prior — initial interval per matrix cell. */
function intervalInitial(repFraction: number, stabilityTransformed: number, difficultyFraction: number): number {
  const scale = INIT_STABILITY_SCALE_MIN
    + (INIT_STABILITY_SCALE_MAX - INIT_STABILITY_SCALE_MIN) * (INIT_ANCHOR - repFraction);
  const power = INIT_REP_POWER_OFFSET + repFraction * (INIT_REP_POWER_COEFF - INIT_REP_POWER_OFFSET);
  const base = (scale - INIT_BASE_SUB) * Math.pow(stabilityTransformed, power) + INIT_BASE_ADD;
  const penalty = Math.min(INIT_PENALTY_CLAMP, repFraction * INIT_PENALTY_SLOPE + INIT_PENALTY_INTERCEPT);
  const exponent = -penalty * difficultyFraction;
  const result = base * exp2Clamped(exponent);
  return Math.max(1.0, applyRounding(result, 4));
}

// =============================================================================
// MATRIX HELPERS
// =============================================================================

function matrixFlatIndex(r: number, s: number, d: number): number {
  return r * MATRIX_STRIDE_R + s * MATRIX_STRIDE_S + d;
}

// =============================================================================
// BAYESIAN CORE
// =============================================================================

/** FUN_00ce1250: Bayesian 3×3×3 neighbor smoothing. */
function bayesianSmooth(
  rIdx: number,
  sIdx: number,
  dIdx: number,
  intervalMatrix: Float64Array,
  countMatrix: Uint32Array,
): number {
  const repFraction = rIdx / 19.0;
  const stabTransformed = Math.pow(sIdx > 0 ? sIdx : 0, STABILITY_POWER) + 2.0;
  const diffFraction = (dIdx + 1) / 20.0;
  const prior = intervalInitial(repFraction, stabTransformed, diffFraction);

  const targetIdx = matrixFlatIndex(rIdx, sIdx, dIdx);
  const targetInterval = intervalMatrix[targetIdx];
  const targetCount = countMatrix[targetIdx];

  let neighborSum = 0;
  let neighborCount = 0;

  const rLo = Math.max(0, rIdx - 1);
  const rHi = Math.min(MATRIX_DIM, rIdx + 2);
  const sLo = Math.max(0, sIdx - 1);
  const sHi = Math.min(MATRIX_DIM, sIdx + 2);
  const dLo = Math.max(0, dIdx - 1);
  const dHi = Math.min(MATRIX_DIM, dIdx + 2);

  for (let nr = rLo; nr < rHi; nr++) {
    for (let ns = sLo; ns < sHi; ns++) {
      for (let nd = dLo; nd < dHi; nd++) {
        if (nr === 0 || ns === 0 || nd === 0) continue;
        const nIdx = matrixFlatIndex(nr, ns, nd);
        const c = countMatrix[nIdx];
        if (c > 0) {
          neighborSum += intervalMatrix[nIdx] * c;
          neighborCount += c;
        }
      }
    }
  }

  const tw = sigmoidWeight(targetCount, BAYES_PRIOR_WEIGHT) * BAYES_TARGET_WEIGHT_SCALE;
  const nw = sigmoidWeight(neighborCount, BAYES_NEIGHBOR_WEIGHT_DENOM);

  const total = neighborCount + 1;
  const avg = (targetInterval + neighborSum) / total;

  const numerator = prior + targetInterval * tw + avg * nw * BAYES_CUBE_WEIGHT;
  const denominator = tw + BAYES_NEUTRAL + nw * BAYES_CUBE_WEIGHT;

  return denominator === 0 ? prior : numerator / denominator;
}

/** Update matrices after a review (incremental average). */
export function sm20RecordReview(
  stability: number,
  difficulty: number,
  repetition: number,
  intervalUsed: number,
  intervalMatrix: Float64Array,
  countMatrix: Uint32Array,
): void {
  const dIdx = clamp(difficultyToIndex(difficulty) - 1, 0, 19);
  const sIdx = clamp(stabilityToIndex(stability) - 1, 0, 19);
  const rIdx = clamp(repetition > 0 ? repetition - 1 : 0, 0, 19);

  const idx = matrixFlatIndex(rIdx, sIdx, dIdx);
  const oldCount = countMatrix[idx];
  const oldInterval = intervalMatrix[idx];

  countMatrix[idx] = oldCount + 1;
  intervalMatrix[idx] = (oldInterval * oldCount + intervalUsed) / (oldCount + 1);
}

// =============================================================================
// COMPUTE NEXT INTERVAL (full algorithm)
// =============================================================================

function computeNextInterval(
  stability: number,
  difficulty: number,
  repetition: number,
  version: number,
  intervalMatrix?: Float64Array,
  countMatrix?: Uint32Array,
): number {
  const st = stabilityPretransform(stability);

  const dIdx = clamp(difficultyToIndex(difficulty) - 1, 0, 19);
  const sIdx = clamp(stabilityToIndex(st) - 1, 0, 19);
  const rIdx = clamp(repetition > 0 ? repetition - 1 : 0, 0, 19);

  const repFrac = repetitionToFraction(clamp(repetition, 1, 20));
  const stabXform = stabilityToTransformed(stabilityToIndex(st));
  const diffFrac = difficultyToFraction(difficultyToIndex(difficulty));

  let sinc: number;
  switch (version) {
    case 4:
      sinc = intervalV4(diffFrac, stabXform, 0.8, 0.0, 0.9, stabXform, repetition);
      break;
    case 6:
      sinc = intervalV6(stabXform, 0.8, stabXform, repetition, diffFrac, 0.9);
      break;
    default:
      sinc = intervalV2(repFrac, stabXform, diffFrac);
  }

  if (intervalMatrix && countMatrix) {
    const targetCount = countMatrix[matrixFlatIndex(rIdx, sIdx, dIdx)];
    if (targetCount > 0) {
      sinc = bayesianSmooth(rIdx, sIdx, dIdx, intervalMatrix, countMatrix);
    }
  }

  return clamp(st * sinc, 1.0, STABILITY_MAX);
}

// =============================================================================
// REVIEW & PREVIEW (app-level)
// =============================================================================

const DEFAULT_STATE: SM20State = {
  version: 2,
  stability: 1.0,
  difficulty: 0.3,
  repetition: 0,
  lapses: 0,
  interval: 1.0,
  last_quality: 0.75,
  algorithm_branch: 0,
  retrov: 0.3,
  s_factor: 1.0,
  multiplier: 1.0,
};

export function parseSm20State(algorithmState?: string): SM20State {
  if (algorithmState) {
    try {
      const parsed = JSON.parse(algorithmState) as Partial<SM20State>;
      if (parsed && typeof parsed.stability === "number" && typeof parsed.difficulty === "number") {
        return {
          version: parsed.version ?? 2,
          stability: parsed.stability,
          difficulty: parsed.difficulty,
          repetition: parsed.repetition ?? 0,
          lapses: parsed.lapses ?? 0,
          interval: parsed.interval ?? Math.max(1.0, parsed.stability),
          last_quality: parsed.last_quality ?? 0.75,
          algorithm_branch: parsed.algorithm_branch ?? 0,
          retrov: parsed.retrov ?? parsed.difficulty,
          s_factor: parsed.s_factor ?? 1.0,
          multiplier: parsed.multiplier ?? 1.0,
        };
      }
    } catch {
      // Ignore malformed state and fall back to defaults.
    }
  }
  return { ...DEFAULT_STATE };
}

function ratingToQuality(rating: number): number {
  switch (rating) {
    case 1: return 0.05;
    case 2: return 0.60;
    case 3: return 0.78;
    case 4: return 0.92;
    default: return 0.78;
  }
}

function successMultiplier(rating: number): number {
  switch (rating) {
    case 2: return 0.85;
    case 4: return 1.15;
    default: return 1.0;
  }
}

function nextDifficulty(currentDifficulty: number, quality: number): number {
  return clamp(currentDifficulty + (0.7 - quality) * 0.18, 0.0, 1.0);
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

  if (state.algorithm_branch === 1) {
    return reviewFsrs(state, rating, elapsedDays);
  }
  return reviewClassic(state, rating, elapsedDays);
}

/** Classic SM-20 review path (V2/V4/V6 + Bayesian). */
function reviewClassic(state: SM20State, rating: number, elapsedDays: number): SM20ReviewResult {
  const quality = ratingToQuality(rating);
  const ret = sm20Retrievability(state.stability, elapsedDays);

  if (rating <= 1) {
    const lapses = state.lapses + 1;
    const intervalDays = lapseInterval(state.stability, lapses);
    return {
      state: {
        version: state.version,
        stability: clamp(intervalDays, STABILITY_CAP, STABILITY_MAX),
        difficulty: nextDifficulty(state.difficulty, quality),
        repetition: 0,
        lapses,
        interval: intervalDays,
        last_quality: quality,
        algorithm_branch: state.algorithm_branch,
        retrov: state.retrov,
        s_factor: state.s_factor,
        multiplier: state.multiplier,
      },
      interval_days: intervalDays,
      retrievability: ret,
    };
  }

  const repetition = clamp(state.repetition + 1, 1, 20);
  const newStability = computeNextInterval(
    state.stability, state.difficulty, repetition, state.version,
  );
  const intervalDays = clamp(newStability * successMultiplier(rating), 1.0, STABILITY_MAX);

  return {
    state: {
      version: state.version,
      stability: intervalDays,
      difficulty: nextDifficulty(state.difficulty, quality),
      repetition,
      lapses: state.lapses,
      interval: intervalDays,
      last_quality: quality,
      algorithm_branch: state.algorithm_branch,
      retrov: state.retrov,
      s_factor: state.s_factor,
      multiplier: state.multiplier,
    },
    interval_days: intervalDays,
    retrievability: ret,
  };
}

/** FSRS-family review path (3-expert mixture model). */
function reviewFsrs(state: SM20State, rating: number, elapsedDays: number): SM20ReviewResult {
  const ret = sm20Retrievability(state.stability, elapsedDays);
  const [newS, newD, interval, _easiness] = fsrsReviewKernel(
    state.stability, state.difficulty, elapsedDays, rating
  );

  const repetition = rating <= 1 ? 0 : clamp(state.repetition + 1, 1, 20);
  const lapses = rating <= 1 ? state.lapses + 1 : state.lapses;

  return {
    state: {
      version: state.version,
      stability: newS,
      difficulty: newD,
      repetition,
      lapses,
      interval,
      last_quality: state.last_quality,
      algorithm_branch: 1,
      retrov: state.retrov,
      s_factor: state.s_factor,
      multiplier: state.multiplier,
    },
    interval_days: interval,
    retrievability: ret,
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
