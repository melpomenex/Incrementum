//! SM-20 Algorithm Implementation
//!
//! Line-by-line translation of `sm20_reference.py`, itself reverse-engineered from
//! sm20.exe via Ghidra (75 functions, 44K fully decompiled). All three algorithm
//! versions (V2/V4/V6) and the Bayesian smoothing core are included.
//!
//! The review-state update around that core is an app-level approximation that maps
//! the app's four-button review flow onto SM-20's DSR model.

use serde::{Deserialize, Serialize};

// =============================================================================
// CONSTANTS
// =============================================================================

/// Runtime BSS constant — set during SM-20 initialization.
const STABILITY_POWER: f64 = 2.90396936502257;

const STABILITY_LOWER: f64 = -1.0;
const STABILITY_CAP: f64 = 0.7;
const STABILITY_MAX: f64 = 44530.0;

/// --- V2 Formula constants (FUN_00ccf070) ---
const V2_STABILITY_SCALE_MAX: f64 = 9.29;
const V2_STABILITY_SCALE_MIN: f64 = 1.3;
const V2_ANCHOR: f64 = 1.0;
const V2_REP_POWER_OFFSET: f64 = -0.08;
const V2_REP_POWER_COEFF: f64 = -0.31;
const V2_BASE_OFFSET: f64 = 1.04;
const V2_BASE_BIAS: f64 = 0.07;
const V2_PENALTY_SLOPE: f64 = -1.88;
const V2_PENALTY_INTERCEPT: f64 = 1.58;
const V2_PENALTY_CLAMP: f64 = 600.0;

/// --- Initial Interval constants (FUN_00ce1900) — Bayesian prior ---
const INIT_STABILITY_SCALE_MAX: f64 = 15.0;
const INIT_STABILITY_SCALE_MIN: f64 = 3.0;
const INIT_ANCHOR: f64 = 1.0;
const INIT_REP_POWER_OFFSET: f64 = -0.08;
const INIT_REP_POWER_COEFF: f64 = -0.35;
const INIT_BASE_SUB: f64 = 1.0;
const INIT_BASE_ADD: f64 = 1.0;
const INIT_PENALTY_SLOPE: f64 = -2.0;
const INIT_PENALTY_INTERCEPT: f64 = 2.25;
const INIT_PENALTY_CLAMP: f64 = 600.0;

/// --- Bayesian Core constants (FUN_00ce1250) ---
const BAYES_PRIOR_WEIGHT: f64 = 500.0;
const BAYES_TARGET_WEIGHT_SCALE: f64 = 10.0;
const BAYES_NEIGHBOR_WEIGHT_DENOM: f64 = 1000.0;
const BAYES_CUBE_WEIGHT: f64 = 3.0;
const BAYES_NEUTRAL: f64 = 1.0;

/// --- Rounding thresholds (FUN_00ce8dd0) ---
const ROUND_WIDE_UPPER: f64 = 20.0;
const ROUND_WIDE_LOWER: f64 = 0.8;
const ROUND_NARROW_UPPER: f64 = 2.0;
const ROUND_NARROW_LOWER: f64 = 0.5;

/// --- U-Factor Table (20 values) ---
/// Extracted from runtime memory. Indexed by difficulty D (0-19).
const UFACTOR: [f64; 20] = [
    13.822076, 8.212571, 6.056511, 4.879609, 4.126662, 3.598557, 3.205138, 2.899285, 2.653822,
    2.451912, 2.282528, 2.138131, 2.013379, 1.904376, 1.808207, 1.722649, 1.645970, 1.576804,
    1.514055, 1.456836,
];

/// Matrix dimensions
const MATRIX_DIM: usize = 21;
const MATRIX_STRIDE_R: usize = MATRIX_DIM * MATRIX_DIM; // 441
const MATRIX_STRIDE_S: usize = MATRIX_DIM; // 21

// =============================================================================
// FSRS-FAMILY BRANCH CONSTANTS
// =============================================================================

/// 35 FSRS-family parameters extracted from runtime memory (PTR_DAT_01125c00).
/// Gated by per-item flags: algorithm_branch == 1.
const FSRS_PARAMS: [f64; 35] = [
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
// DATA TYPES
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SM20State {
    pub version: u8,
    pub stability: f64,
    pub difficulty: f64,
    pub repetition: u32,
    pub lapses: u32,
    pub interval: f64,
    pub last_quality: f64,
    #[serde(default)]
    pub algorithm_branch: u8,
    #[serde(default)]
    pub retrov: f64,
    #[serde(default = "default_one")]
    pub s_factor: f64,
    #[serde(default = "default_one")]
    pub multiplier: f64,
}

fn default_one() -> f64 {
    1.0
}

impl Default for SM20State {
    fn default() -> Self {
        Self {
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
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SM20ReviewResult {
    pub state: SM20State,
    pub interval_days: f64,
    pub retrievability: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SM20PreviewIntervals {
    pub again: f64,
    pub hard: f64,
    pub good: f64,
    pub easy: f64,
}

// =============================================================================
// LOW-LEVEL HELPERS
// =============================================================================

fn clamp(value: f64, lo: f64, hi: f64) -> f64 {
    value.max(lo).min(hi)
}

fn clamp_usize(value: usize, lo: usize, hi: usize) -> usize {
    value.max(lo).min(hi)
}

fn exp2_clamped(x: f64) -> f64 {
    2.0_f64.powf(clamp(x, -38.0, 38.0))
}

fn sigmoid_weight(x: f64, y: f64) -> f64 {
    let s = x + y;
    if s == 0.0 {
        0.0
    } else {
        x / s
    }
}

// =============================================================================
// FSRS-FAMILY EXPERT FUNCTIONS
// =============================================================================

/// FUN_00af8ac0: Expert 1 — power-law forgetting.
/// result = S * (S/(S+t))^pow(p[0]/0.9, 2)
/// Activates when: threshold (0) < p[0] AND threshold (0) < S
pub(crate) fn fsrs_expert1(t: f64, s: f64) -> f64 {
    let threshold = 0.0;
    let param1 = FSRS_PARAMS[0];
    if !(threshold < param1 && threshold < s) {
        return 0.0;
    }
    let exp_power = (param1 / 0.9).powi(2);
    let ratio = s / (s + t);
    s * ratio.powf(exp_power)
}

/// FUN_00af8bb0: Expert 2 — FSRS-style power-law forgetting.
/// result = pow(t/S + 1, log2(0.9)) = (1 + t/S)^(-0.152)
/// Bounded to [0,1] and decreasing — a proper forgetting curve.
pub(crate) fn fsrs_expert2(t: f64, s: f64) -> f64 {
    let threshold = 0.0;
    let t_over_s = if s > 0.0 { t / s } else { 0.0 };
    let shifted = t_over_s + 1.0;
    if !(threshold < t && threshold < shifted) {
        return 0.0;
    }
    // FUN_0040c140(0.9) / FUN_0040c140(2) = log2(0.9) / log2(2) = log2(0.9)
    shifted.powf(0.9_f64.log2()) // ≈ -0.152
}

/// FUN_00af8c90: Expert 3 — exponential forgetting.
/// result = 2^(-|t/S| * 0.1053605) ≈ 0.9296^(t/S)
pub(crate) fn fsrs_expert3(t: f64, s: f64) -> f64 {
    if !(0.0 < t) {
        return 0.0;
    }
    let ratio = if s > 0.0 { t / s } else { 0.0 };
    2.0_f64.powf(-ratio.abs() * 0.1053605)
}

/// FUN_00af8d00: 3-expert weighted average → retrievability-like proxy A.
pub(crate) fn fsrs_expert_mixture(t: f64, s: f64) -> f64 {
    let e1 = fsrs_expert1(t, s);
    let e2 = fsrs_expert2(t, s);
    let e3 = fsrs_expert3(t, s);

    let w1_time = 1.0 - sigmoid_weight(t, FSRS_PARAMS[1]);
    let w1_stab = sigmoid_weight(s, FSRS_PARAMS[2]);
    let w1 = (w1_time + w1_stab) / 2.0;

    let w2_time = 1.0 - sigmoid_weight(t, FSRS_PARAMS[1]);
    let w2_stab = sigmoid_weight(s, FSRS_PARAMS[3]);
    let w2 = (w2_time + w2_stab) / 2.0;

    let w3 = sigmoid_weight(t, FSRS_PARAMS[4]);

    let w_sum = w1 + w2 + w3;
    if w_sum == 0.0 {
        return 0.0;
    }
    (w1 * e1 + w2 * e2 + w3 * e3) / w_sum
}

// =============================================================================
// FSRS-FAMILY UPDATE FUNCTIONS
// =============================================================================

/// FUN_00af90f0: Update difficulty based on review outcome.
pub(crate) fn fsrs_difficulty_update(d: f64, s: f64, a: f64, grade: i32) -> f64 {
    let ratio = sigmoid_weight(s, FSRS_PARAMS[24]);
    let d_target = if grade > 2 { 1.0 } else { 0.0 };
    let d_new = ratio * d + (1.0 - ratio) * (d - (d_target - a));
    clamp(d_new, 0.0, 1.0)
}

/// FUN_00af9010: Stability update for lapse (grade < 3).
pub(crate) fn fsrs_lapse_stability(d: f64, s: f64, a: f64) -> f64 {
    let mut s_new = (1.0 - d) * FSRS_PARAMS[19] + 1.0;
    let w = sigmoid_weight(s, FSRS_PARAMS[20]);
    s_new *= w * FSRS_PARAMS[21] + 1.0;
    let retrov_signal = 1.0 - a;
    let r = sigmoid_weight(retrov_signal, FSRS_PARAMS[22]);
    s_new *= r * FSRS_PARAMS[23] + 1.0;
    s_new
}

/// FUN_00af91f0: Stability update for successful recall (grade >= 3).
pub(crate) fn fsrs_recall_stability(d: f64, s: f64, a: f64, t: f64, grade: i32) -> f64 {
    let s_min = s.max(t);

    let hard_bonus = if t < s {
        let t_over_s = if s > 0.0 { t / s } else { 0.0 };
        FSRS_PARAMS[28] + FSRS_PARAMS[29] * sigmoid_weight(t_over_s, FSRS_PARAMS[30])
    } else {
        FSRS_PARAMS[28]
    };

    let time_factor = if s > 0.0 {
        s.powf(FSRS_PARAMS[31])
    } else {
        1.0
    };

    let recall_signal = exp2_clamped(-(FSRS_PARAMS[32] * (1.0 - d) + FSRS_PARAMS[33]) * a);

    let grade_factor = (grade - 4) as f64 * FSRS_PARAMS[34] + 1.0;

    let blend = FSRS_PARAMS[26] + (1.0 - d) * (FSRS_PARAMS[25] - FSRS_PARAMS[26]);

    s_min * hard_bonus * (FSRS_PARAMS[27] + blend * time_factor * recall_signal * grade_factor)
}

/// FUN_00af9420: Main FSRS review kernel.
/// Returns (new_S, new_D, interval, easiness).
pub(crate) fn fsrs_review_kernel(s: f64, d: f64, t: f64, grade: i32) -> (f64, f64, f64, f64) {
    let a = fsrs_expert_mixture(t, s);
    let d_new = fsrs_difficulty_update(d, s, a, grade);

    let s_new = if grade < 3 {
        fsrs_lapse_stability(d_new, s, a)
    } else {
        fsrs_recall_stability(d_new, s, a, t, grade)
    };

    let interval = if s_new > 1.0 { s_new } else { 1.0 };
    let easiness = if s > 1.0 { s_new / s } else { 0.0 };

    (s_new, d_new, interval, easiness)
}

/// FUN_00ceb590: Initialize a new FSRS item.
pub fn fsrs_init_item(grade: i32, stability: f64, flag: bool) -> SM20State {
    let d = FSRS_PARAMS[(5 + grade as usize).min(10)];
    let s_factor = FSRS_PARAMS[(11 + grade as usize).min(18)];

    SM20State {
        version: 2,
        stability,
        difficulty: d,
        repetition: 0,
        lapses: 0,
        interval: stability.max(1.0),
        last_quality: 0.75,
        algorithm_branch: 1,
        retrov: d,
        s_factor,
        multiplier: if flag { 0.5 } else { 3.0 },
    }
}

// =============================================================================
// RETRIEVABILITY
// =============================================================================

pub fn retrievability(stability: f64, elapsed_days: f64) -> f64 {
    if !stability.is_finite() || stability <= 0.0 {
        return 0.0;
    }
    0.9_f64.powf(elapsed_days.max(0.0) / stability)
}

// =============================================================================
// INDEX CONVERSIONS
// =============================================================================

/// FUN_00cf7550: Validate and clamp stability.
pub(crate) fn stability_pretransform(s: f64) -> f64 {
    if !s.is_finite() {
        return STABILITY_MAX;
    }
    if s <= STABILITY_LOWER {
        return s;
    }
    if s < STABILITY_CAP {
        return STABILITY_CAP;
    }
    if s <= STABILITY_MAX {
        return s;
    }
    STABILITY_MAX
}

/// FUN_00cf6fd0: floor(D * 19) + 1, result in [1, 10]. D<0 returns index 10.
pub(crate) fn difficulty_to_index(d: f64) -> usize {
    if d < 0.0 {
        return 10;
    }
    std::cmp::min((d * 19.0).floor() as usize + 1, 10)
}

/// FUN_00cf7330: Convert stability to matrix index in [1, 20].
pub(crate) fn stability_to_index(s: f64) -> usize {
    let s = stability_pretransform(s);
    let diff = (s - 2.0).max(0.0);
    let result = diff.powf(1.0 / STABILITY_POWER);
    clamp_usize((result.floor() as usize) + 1, 1, 20)
}

/// FUN_00cf7420: Convert stability INDEX to transformed value.
pub(crate) fn stability_to_transformed(s_idx: usize) -> f64 {
    ((s_idx - 1) as f64).powf(STABILITY_POWER) + 2.0
}

/// FUN_00cf7250: floor(exp2(R * 20)), clamped to [0, 20].
fn retrievability_to_index(r: f64) -> usize {
    clamp_usize((2.0_f64.powf(r * 20.0)).floor() as usize, 0, 20)
}

/// FUN_00cf73d0: D / 20.0
pub(crate) fn difficulty_to_fraction(d_idx: usize) -> f64 {
    d_idx as f64 / 20.0
}

/// FUN_00cf71c0: (R - 1) / 19
pub(crate) fn repetition_to_fraction(r: u32) -> f64 {
    (r - 1) as f64 / 19.0
}

// =============================================================================
// ROUNDING
// =============================================================================

/// FUN_00ce8dd0: Clamp interval to threshold range.
fn apply_rounding(interval: f64, flags: i32) -> f64 {
    let (upper, lower) = if flags >= 4 || (flags & 2) != 0 {
        (ROUND_WIDE_UPPER, ROUND_WIDE_LOWER)
    } else {
        (ROUND_NARROW_UPPER, ROUND_NARROW_LOWER)
    };

    if interval > upper {
        return upper;
    }
    if interval <= lower && (interval - lower).abs() > 1e-15 {
        return lower;
    }
    interval
}

// =============================================================================
// INTERVAL FORMULAS
// =============================================================================

/// FUN_00ccf070: Version 2 interval (SM-19 compatible).
pub(crate) fn interval_v2(rep_fraction: f64, stability_transformed: f64, difficulty_fraction: f64) -> f64 {
    let scale = V2_STABILITY_SCALE_MIN
        + (V2_STABILITY_SCALE_MAX - V2_STABILITY_SCALE_MIN) * (V2_ANCHOR - rep_fraction);
    let power = V2_REP_POWER_OFFSET + rep_fraction * (V2_REP_POWER_COEFF - V2_REP_POWER_OFFSET);
    let base =
        (scale - V2_BASE_OFFSET) * stability_transformed.powf(power) + V2_BASE_BIAS;
    let penalty = (rep_fraction * V2_PENALTY_SLOPE + V2_PENALTY_INTERCEPT).min(V2_PENALTY_CLAMP);
    let exponent = -penalty * difficulty_fraction;
    base * exp2_clamped(exponent)
}

/// FUN_00ccd8e0: Version 4 interval (SM-20 proper).
pub(crate) fn interval_v4(p1: f64, p2: f64, p3: f64, p4: f64, p5: f64, _p6: f64, p7: f64) -> f64 {
    (p3 * p5 + 1.0) * (p1 * p7 + p2) + p4
}

/// FUN_00ccfde0: Version 6 interval (FSRS-style).
pub(crate) fn interval_v6(p1: f64, _p2: f64, p3: f64, p4: f64, p5: f64, p6: f64) -> f64 {
    p4 + p1 * exp2_clamped(p6) * exp2_clamped(-p3 * p5)
}

/// FUN_00ce1900: Bayesian prior — initial interval per matrix cell.
fn interval_initial(rep_fraction: f64, stability_transformed: f64, difficulty_fraction: f64) -> f64 {
    let scale = INIT_STABILITY_SCALE_MIN
        + (INIT_STABILITY_SCALE_MAX - INIT_STABILITY_SCALE_MIN) * (INIT_ANCHOR - rep_fraction);
    let power =
        INIT_REP_POWER_OFFSET + rep_fraction * (INIT_REP_POWER_COEFF - INIT_REP_POWER_OFFSET);
    let base = (scale - INIT_BASE_SUB) * stability_transformed.powf(power) + INIT_BASE_ADD;
    let penalty = (rep_fraction * INIT_PENALTY_SLOPE + INIT_PENALTY_INTERCEPT).min(INIT_PENALTY_CLAMP);
    let exponent = -penalty * difficulty_fraction;
    let result = base * exp2_clamped(exponent);
    let result = apply_rounding(result, 4); // wide mode
    result.max(1.0)
}

// =============================================================================
// MATRIX HELPERS
// =============================================================================

fn matrix_flat_index(r: usize, s: usize, d: usize) -> usize {
    r * MATRIX_STRIDE_R + s * MATRIX_STRIDE_S + d
}

// =============================================================================
// BAYESIAN CORE
// =============================================================================

/// FUN_00ce1250: Bayesian 3x3x3 neighbor smoothing.
fn bayesian_smooth(
    r_idx: usize,
    s_idx: usize,
    d_idx: usize,
    interval_matrix: &[f64; 9261],
    count_matrix: &[u32; 9261],
) -> f64 {
    // Reconstruct parameters for prior computation
    let rep_fraction = r_idx as f64 / 19.0;
    let stab_transformed = (if s_idx > 0 { s_idx } else { 0 } as f64).powf(STABILITY_POWER) + 2.0;
    let diff_fraction = (d_idx + 1) as f64 / 20.0;

    let prior = interval_initial(rep_fraction, stab_transformed, diff_fraction);

    // Target cell
    let target_idx = matrix_flat_index(r_idx, s_idx, d_idx);
    let target_interval = interval_matrix[target_idx];
    let target_count = count_matrix[target_idx];

    // 3×3×3 neighbor accumulation
    let mut neighbor_sum = 0.0;
    let mut neighbor_count: u32 = 0;

    let r_lo = r_idx.saturating_sub(1);
    let r_hi = (r_idx + 2).min(MATRIX_DIM);
    let s_lo = s_idx.saturating_sub(1);
    let s_hi = (s_idx + 2).min(MATRIX_DIM);
    let d_lo = d_idx.saturating_sub(1);
    let d_hi = (d_idx + 2).min(MATRIX_DIM);

    for nr in r_lo..r_hi {
        for ns in s_lo..s_hi {
            for nd in d_lo..d_hi {
                // Boundary check: skip if any index is 0
                if nr == 0 || ns == 0 || nd == 0 {
                    continue;
                }
                let n_idx = matrix_flat_index(nr, ns, nd);
                let c = count_matrix[n_idx];
                if c > 0 {
                    neighbor_sum += interval_matrix[n_idx] * c as f64;
                    neighbor_count += c;
                }
            }
        }
    }

    // Weights
    let tw = sigmoid_weight(target_count as f64, BAYES_PRIOR_WEIGHT) * BAYES_TARGET_WEIGHT_SCALE;
    let nw = sigmoid_weight(neighbor_count as f64, BAYES_NEIGHBOR_WEIGHT_DENOM);

    // Blended average
    let total = (neighbor_count + 1) as f64;
    let avg = (target_interval + neighbor_sum) / total;

    let numerator = prior + target_interval * tw + avg * nw * BAYES_CUBE_WEIGHT;
    let denominator = tw + BAYES_NEUTRAL + nw * BAYES_CUBE_WEIGHT;

    if denominator == 0.0 {
        prior
    } else {
        numerator / denominator
    }
}

/// Update matrices after a review (incremental average).
pub fn record_review(
    stability: f64,
    difficulty: f64,
    repetition: u32,
    interval_used: f64,
    interval_matrix: &mut [f64; 9261],
    count_matrix: &mut [u32; 9261],
) {
    let d_idx = clamp_usize(difficulty_to_index(difficulty) - 1, 0, 19);
    let s_idx = clamp_usize(stability_to_index(stability) - 1, 0, 19);
    let r_idx = clamp_usize(repetition.saturating_sub(1) as usize, 0, 19);

    let idx = matrix_flat_index(r_idx, s_idx, d_idx);
    let old_count = count_matrix[idx];
    let old_interval = interval_matrix[idx];

    count_matrix[idx] = old_count + 1;
    interval_matrix[idx] = (old_interval * old_count as f64 + interval_used) / (old_count + 1) as f64;
}

// =============================================================================
// COMPUTE NEXT INTERVAL (full algorithm)
// =============================================================================

pub(crate) fn compute_next_interval(
    stability: f64,
    difficulty: f64,
    repetition: u32,
    version: u8,
    interval_matrix: Option<&[f64; 9261]>,
    count_matrix: Option<&[u32; 9261]>,
) -> f64 {
    let stability = stability_pretransform(stability);

    // Convert to matrix indices
    let d_idx = clamp_usize(difficulty_to_index(difficulty) - 1, 0, 19);
    let s_idx = clamp_usize(stability_to_index(stability) - 1, 0, 19);
    let r_idx = clamp_usize(repetition.saturating_sub(1) as usize, 0, 19);

    // Convert to formula parameters (quantized)
    let rep_frac = repetition_to_fraction(repetition.clamp(1, 20));
    let stab_xform = stability_to_transformed(stability_to_index(stability));
    let diff_frac = difficulty_to_fraction(difficulty_to_index(difficulty));

    // Compute via algorithm version
    let sinc = match version {
        4 => interval_v4(
            diff_frac,
            stab_xform,
            0.8,
            0.0,
            0.9,
            stab_xform,
            repetition as f64,
        ),
        6 => interval_v6(stab_xform, 0.8, stab_xform, repetition as f64, diff_frac, 0.9),
        _ => interval_v2(rep_frac, stab_xform, diff_frac),
    };

    // Apply Bayesian smoothing if matrices available
    let sinc = if let (Some(im), Some(cm)) = (interval_matrix, count_matrix) {
        let target_count = cm[matrix_flat_index(r_idx, s_idx, d_idx)];
        if target_count > 0 {
            bayesian_smooth(r_idx, s_idx, d_idx, im, cm)
        } else {
            sinc
        }
    } else {
        sinc
    };

    // New stability = old × SInc
    clamp(stability * sinc, 1.0, STABILITY_MAX)
}

// =============================================================================
// REVIEW & PREVIEW (app-level)
// =============================================================================

fn rating_to_quality(rating: i32) -> f64 {
    match rating {
        1 => 0.05,
        2 => 0.60,
        3 => 0.78,
        4 => 0.92,
        _ => 0.78,
    }
}

fn success_multiplier(rating: i32) -> f64 {
    match rating {
        2 => 0.85,
        4 => 1.15,
        _ => 1.0,
    }
}

fn next_difficulty(current_difficulty: f64, quality: f64) -> f64 {
    clamp(current_difficulty + (0.7 - quality) * 0.18, 0.0, 1.0)
}

fn lapse_interval(stability: f64, lapses: u32) -> f64 {
    let decayed = (stability * 0.35).max(0.5);
    clamp(decayed / (1.0 + lapses as f64 * 0.15), 0.5, 3.0)
}

pub fn review(current_state: &SM20State, rating: i32, elapsed_days: f64) -> SM20ReviewResult {
    let state = current_state.clone();

    // FSRS-family branch dispatch
    if state.algorithm_branch == 1 {
        return review_fsrs(&state, rating, elapsed_days);
    }

    // Classic branch
    review_classic(&state, rating, elapsed_days)
}

/// Classic SM-20 review path (V2/V4/V6 + Bayesian).
fn review_classic(state: &SM20State, rating: i32, elapsed_days: f64) -> SM20ReviewResult {
    let quality = rating_to_quality(rating);
    let current_retrievability = retrievability(state.stability, elapsed_days);

    if rating <= 1 {
        let lapses = state.lapses + 1;
        let interval_days = lapse_interval(state.stability, lapses);
        let next_state = SM20State {
            version: state.version,
            stability: clamp(interval_days, STABILITY_CAP, STABILITY_MAX),
            difficulty: next_difficulty(state.difficulty, quality),
            repetition: 0,
            lapses,
            interval: interval_days,
            last_quality: quality,
            algorithm_branch: state.algorithm_branch,
            retrov: state.retrov,
            s_factor: state.s_factor,
            multiplier: state.multiplier,
        };

        return SM20ReviewResult {
            state: next_state,
            interval_days,
            retrievability: current_retrievability,
        };
    }

    let repetition = (state.repetition + 1).clamp(1, 20);
    let new_stability =
        compute_next_interval(state.stability, state.difficulty, repetition, state.version, None, None);
    let interval_days = clamp(new_stability * success_multiplier(rating), 1.0, STABILITY_MAX);

    let next_state = SM20State {
        version: state.version,
        stability: interval_days,
        difficulty: next_difficulty(state.difficulty, quality),
        repetition,
        lapses: state.lapses,
        interval: interval_days,
        last_quality: quality,
        algorithm_branch: state.algorithm_branch,
        retrov: state.retrov,
        s_factor: state.s_factor,
        multiplier: state.multiplier,
    };

    SM20ReviewResult {
        state: next_state,
        interval_days,
        retrievability: current_retrievability,
    }
}

/// FSRS-family review path (3-expert mixture model).
fn review_fsrs(state: &SM20State, rating: i32, elapsed_days: f64) -> SM20ReviewResult {
    let current_retrievability = retrievability(state.stability, elapsed_days);
    let (new_s, new_d, interval, _easiness) =
        fsrs_review_kernel(state.stability, state.difficulty, elapsed_days, rating);

    let repetition = if rating <= 1 { 0 } else { (state.repetition + 1).clamp(1, 20) };
    let lapses = if rating <= 1 { state.lapses + 1 } else { state.lapses };

    let next_state = SM20State {
        version: state.version,
        stability: new_s,
        difficulty: new_d,
        repetition,
        lapses,
        interval,
        last_quality: state.last_quality,
        algorithm_branch: 1,
        retrov: state.retrov,
        s_factor: state.s_factor,
        multiplier: state.multiplier,
    };

    SM20ReviewResult {
        state: next_state,
        interval_days: interval,
        retrievability: current_retrievability,
    }
}

pub fn preview(current_state: &SM20State, elapsed_days: f64) -> SM20PreviewIntervals {
    SM20PreviewIntervals {
        again: review(current_state, 1, elapsed_days).interval_days,
        hard: review(current_state, 2, elapsed_days).interval_days,
        good: review(current_state, 3, elapsed_days).interval_days,
        easy: review(current_state, 4, elapsed_days).interval_days,
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // --- Index conversion tests ---

    #[test]
    fn difficulty_to_index_zero() {
        assert_eq!(difficulty_to_index(0.0), 1);
    }

    #[test]
    fn difficulty_to_index_one() {
        assert_eq!(difficulty_to_index(1.0), 10);
    }

    #[test]
    fn difficulty_to_index_mid() {
        assert_eq!(difficulty_to_index(0.5), 10);
    }

    #[test]
    fn difficulty_to_index_negative() {
        assert_eq!(difficulty_to_index(-0.5), 10);
    }

    #[test]
    fn difficulty_to_index_just_above_zero() {
        assert_eq!(difficulty_to_index(0.01), 1);
    }

    #[test]
    fn difficulty_to_fraction_range() {
        let frac = difficulty_to_fraction(1);
        assert!((frac - 0.05).abs() < 1e-10);
        let frac = difficulty_to_fraction(10);
        assert!((frac - 0.5).abs() < 1e-10);
    }

    #[test]
    fn repetition_to_fraction_first() {
        assert!((repetition_to_fraction(1) - 0.0).abs() < 1e-10);
    }

    #[test]
    fn repetition_to_fraction_last() {
        assert!((repetition_to_fraction(20) - 1.0).abs() < 1e-10);
    }

    // --- Stability pre-transform tests ---

    #[test]
    fn pretransform_nan() {
        assert_eq!(stability_pretransform(f64::NAN), STABILITY_MAX);
    }

    #[test]
    fn pretransform_inf() {
        assert_eq!(stability_pretransform(f64::INFINITY), STABILITY_MAX);
    }

    #[test]
    fn pretransform_neg_inf() {
        assert_eq!(stability_pretransform(f64::NEG_INFINITY), STABILITY_MAX);
    }

    #[test]
    fn pretransform_low_positive_clamped() {
        assert_eq!(stability_pretransform(0.3), 0.7);
    }

    #[test]
    fn pretransform_valid_passes_through() {
        assert_eq!(stability_pretransform(5.0), 5.0);
    }

    #[test]
    fn pretransform_error_sentinel() {
        assert_eq!(stability_pretransform(-2.0), -2.0);
    }

    #[test]
    fn pretransform_boundary_lower() {
        assert_eq!(stability_pretransform(-1.0), -1.0);
    }

    #[test]
    fn pretransform_boundary_cap() {
        assert_eq!(stability_pretransform(0.7), 0.7);
    }

    #[test]
    fn pretransform_exceeds_max() {
        assert_eq!(stability_pretransform(50000.0), STABILITY_MAX);
    }

    // --- Stability index tests ---

    #[test]
    fn stability_to_index_low() {
        // S=0.7 → diff = -1.3 → clamped to 0 → pow(0, 0.344) = 0 → idx = 1
        assert_eq!(stability_to_index(0.7), 1);
    }

    #[test]
    fn stability_to_index_three() {
        // S=3.0 → diff=1.0 → pow(1.0, 0.344)=1.0 → idx=2
        assert_eq!(stability_to_index(3.0), 2);
    }

    #[test]
    fn stability_to_transformed_roundtrip() {
        let idx = stability_to_index(5.0);
        let xform = stability_to_transformed(idx);
        // Should be in a reasonable range
        assert!(xform > 2.0);
    }

    // --- Rounding tests ---

    #[test]
    fn rounding_wide_clamps_high() {
        assert_eq!(apply_rounding(25.0, 4), 20.0);
    }

    #[test]
    fn rounding_wide_passes_lower_bound() {
        assert_eq!(apply_rounding(0.8, 4), 0.8);
    }

    #[test]
    fn rounding_narrow_clamps_high() {
        assert_eq!(apply_rounding(3.0, 0), 2.0);
    }

    #[test]
    fn rounding_narrow_clamps_low() {
        assert_eq!(apply_rounding(0.3, 0), 0.5);
    }

    // --- Retrievability ---

    #[test]
    fn retrievability_uses_ninety_percent_curve() {
        assert!((retrievability(10.0, 10.0) - 0.9).abs() < 1e-10);
    }

    // --- V2 formula tests ---

    #[test]
    fn v2_interval_positive() {
        let sinc = interval_v2(0.0, 3.0, 0.25);
        assert!(sinc > 0.0);
    }

    #[test]
    fn v2_interval_decreases_with_difficulty() {
        let easy = interval_v2(0.5, 5.0, 0.05);
        let hard = interval_v2(0.5, 5.0, 0.5);
        assert!(hard < easy);
    }

    // --- V4 formula tests ---

    #[test]
    fn v4_interval_known_value() {
        // (0.8 * 0.9 + 1.0) * (0.25 * 3.0 + 3.0) + 0.0 = 1.72 * 3.75 = 6.45
        let result = interval_v4(0.25, 3.0, 0.8, 0.0, 0.9, 3.0, 3.0);
        assert!((result - 6.45).abs() < 1e-10);
    }

    // --- V6 formula tests ---

    #[test]
    fn v6_interval_positive() {
        let result = interval_v6(3.0, 0.8, 3.0, 3.0, 0.25, 0.9);
        assert!(result > 0.0);
    }

    // --- Initial interval tests ---

    #[test]
    fn initial_interval_minimum_one() {
        let result = interval_initial(0.0, 2.0, 0.5);
        assert!(result >= 1.0);
    }

    #[test]
    fn initial_interval_wide_rounding() {
        // With high values, should be clamped to 20.0
        let result = interval_initial(0.0, 1000.0, 0.05);
        assert!(result <= 20.0);
    }

    // --- Bayesian smooth tests ---

    #[test]
    fn bayesian_smooth_empty_matrices_returns_prior() {
        let interval_matrix = [0.0f64; 9261];
        let count_matrix = [0u32; 9261];
        let result = bayesian_smooth(5, 10, 3, &interval_matrix, &count_matrix);
        // With empty matrices, result should equal the prior
        let rep_fraction = 5.0 / 19.0;
        let stab_transformed = (10.0_f64).powf(STABILITY_POWER) + 2.0;
        let diff_fraction = 4.0 / 20.0;
        let prior = interval_initial(rep_fraction, stab_transformed, diff_fraction);
        assert!((result - prior).abs() < 1e-10);
    }

    #[test]
    fn record_review_first_review() {
        let mut interval_matrix = [0.0f64; 9261];
        let mut count_matrix = [0u32; 9261];
        record_review(5.0, 0.3, 3, 7.0, &mut interval_matrix, &mut count_matrix);
        // Find the cell
        let d_idx = clamp_usize(difficulty_to_index(0.3) - 1, 0, 19);
        let s_idx = clamp_usize(stability_to_index(5.0) - 1, 0, 19);
        let r_idx = 2; // repetition 3 → index 2
        let idx = matrix_flat_index(r_idx, s_idx, d_idx);
        assert_eq!(count_matrix[idx], 1);
        assert!((interval_matrix[idx] - 7.0).abs() < 1e-10);
    }

    #[test]
    fn record_review_incremental_average() {
        let mut interval_matrix = [0.0f64; 9261];
        let mut count_matrix = [0u32; 9261];
        record_review(5.0, 0.3, 3, 3.0, &mut interval_matrix, &mut count_matrix);
        record_review(5.0, 0.3, 3, 5.0, &mut interval_matrix, &mut count_matrix);
        let d_idx = clamp_usize(difficulty_to_index(0.3) - 1, 0, 19);
        let s_idx = clamp_usize(stability_to_index(5.0) - 1, 0, 19);
        let r_idx = 2;
        let idx = matrix_flat_index(r_idx, s_idx, d_idx);
        assert_eq!(count_matrix[idx], 2);
        assert!((interval_matrix[idx] - 4.0).abs() < 1e-10);
    }

    // --- Review behavior tests ---

    #[test]
    fn successful_review_grows_interval() {
        let state = SM20State {
            stability: 2.0,
            difficulty: 0.3,
            repetition: 2,
            lapses: 0,
            interval: 2.0,
            ..Default::default()
        };
        let result = review(&state, 3, 2.0);
        assert!(result.interval_days > state.interval);
        assert_eq!(result.state.repetition, 3);
    }

    #[test]
    fn lapse_resets_repetition_and_increments_lapses() {
        let state = SM20State {
            stability: 8.0,
            difficulty: 0.3,
            repetition: 5,
            lapses: 0,
            interval: 8.0,
            ..Default::default()
        };
        let result = review(&state, 1, 8.0);
        assert!(result.interval_days < state.interval);
        assert_eq!(result.state.repetition, 0);
        assert_eq!(result.state.lapses, 1);
    }

    #[test]
    fn preview_intervals_are_monotonic() {
        let preview = preview(&SM20State::default(), 0.0);
        assert!(preview.again < preview.hard);
        assert!(preview.hard < preview.good);
        assert!(preview.good < preview.easy);
    }

    // --- Version dispatch tests ---

    #[test]
    fn version_2_produces_v2_intervals() {
        let s = compute_next_interval(5.0, 0.3, 3, 2, None, None);
        assert!(s > 0.0);
    }

    #[test]
    fn version_4_produces_v4_intervals() {
        let s = compute_next_interval(5.0, 0.3, 3, 4, None, None);
        assert!(s > 0.0);
    }

    #[test]
    fn version_6_produces_v6_intervals() {
        let s = compute_next_interval(5.0, 0.3, 3, 6, None, None);
        assert!(s > 0.0);
    }

    #[test]
    fn version_99_falls_back_to_v2() {
        let s_v2 = compute_next_interval(5.0, 0.3, 3, 2, None, None);
        let s_fallback = compute_next_interval(5.0, 0.3, 3, 99, None, None);
        assert!((s_v2 - s_fallback).abs() < 1e-10);
    }

    // --- UFactor table tests ---

    #[test]
    fn ufactor_first_element() {
        assert!((UFACTOR[0] - 13.822076).abs() < 1e-6);
    }

    #[test]
    fn ufactor_monotonic_decrease() {
        for i in 1..UFACTOR.len() {
            assert!(UFACTOR[i] <= UFACTOR[i - 1]);
        }
    }

    // --- Retrievability index ---

    #[test]
    fn retrievability_to_index_range() {
        let idx = retrievability_to_index(0.5);
        assert!(idx >= 0 && idx <= 20);
    }

    // =========================================================================
    // Reference-value tests — pinned against sm20_reference.py output
    // =========================================================================

    #[test]
    fn ref_v2_sinc_sweep() {
        // S=5, D=0.5 → s_xform=3.0, d_frac=0.5
        let s_xform = stability_to_transformed(stability_to_index(5.0));
        let d_frac = difficulty_to_fraction(difficulty_to_index(0.5));
        assert!((s_xform - 3.0).abs() < 1e-10);
        assert!((d_frac - 0.5).abs() < 1e-10);

        let cases: [(u32, f64); 6] = [
            (1, 4.410375), (3, 4.136039), (5, 3.830098),
            (10, 2.912187), (15, 1.744452), (20, 0.282890),
        ];
        for (rep, expected) in cases {
            let rep_frac = repetition_to_fraction(rep);
            let sinc = interval_v2(rep_frac, s_xform, d_frac);
            assert!(
                (sinc - expected).abs() < 1e-4,
                "rep={rep}: got {sinc}, expected {expected}"
            );
        }
    }

    #[test]
    fn ref_v4_exact() {
        let result = interval_v4(0.5, 1.0, 0.8, 0.0, 0.9, 2.0, 5.0);
        assert!((result - 6.02).abs() < 1e-10);
    }

    #[test]
    fn ref_v6_exact() {
        let result = interval_v6(1.0, 0.8, 0.9, 1.0, 2.0, 0.5);
        assert!((result - 1.406126).abs() < 1e-4);
    }

    #[test]
    fn ref_compute_next_interval_v2() {
        let cases: [(f64, f64, u32, f64); 9] = [
            (5.0, 0.3, 3, 25.047573369813723),
            (1.0, 0.1, 1, 7.058078377193328),
            (100.0, 0.7, 10, 168.758627276562379),
            (0.7, 0.5, 1, 3.188111922896065),
            (44530.0, 0.0, 20, 3975.557198164805868),
            (2.0, 0.0, 1, 14.910693464872152),
            (2.0, 1.0, 1, 9.108891208274471),
            (10.0, 0.5, 5, 33.101613644437087),
            (50.0, 0.3, 15, 53.543559461267684),
        ];
        for (s, d, r, expected) in cases {
            let result = compute_next_interval(s, d, r, 2, None, None);
            assert!(
                (result - expected).abs() < 1e-8,
                "S={s}, D={d}, R={r}: got {result}, expected {expected}"
            );
        }
    }

    #[test]
    fn ref_compute_next_interval_v4_v6_fallback() {
        let v2 = compute_next_interval(5.0, 0.3, 3, 2, None, None);
        let v4 = compute_next_interval(5.0, 0.3, 3, 4, None, None);
        let v6 = compute_next_interval(5.0, 0.3, 3, 6, None, None);
        let fallback = compute_next_interval(5.0, 0.3, 3, 99, None, None);

        assert!((v2 - 25.047573369813723).abs() < 1e-8);
        assert!((v4 - 33.54).abs() < 1e-8);
        assert!((v6 - 30.0).abs() < 1e-8);
        assert!((fallback - v2).abs() < 1e-10, "fallback should match V2");
    }

    #[test]
    fn ref_stability_pretransform() {
        assert_eq!(stability_pretransform(-2.0), -2.0);
        assert_eq!(stability_pretransform(-0.5), 0.7);
        assert_eq!(stability_pretransform(0.5), 0.7);
        assert_eq!(stability_pretransform(0.7), 0.7);
        assert_eq!(stability_pretransform(1.0), 1.0);
        assert_eq!(stability_pretransform(100.0), 100.0);
        assert_eq!(stability_pretransform(44530.0), 44530.0);
        assert_eq!(stability_pretransform(50000.0), 44530.0);
        assert_eq!(stability_pretransform(f64::NAN), 44530.0);
        assert_eq!(stability_pretransform(f64::INFINITY), 44530.0);
    }

    // =========================================================================
    // FSRS-family tests — pinned against sm20_reference.py output
    // =========================================================================

    #[test]
    fn fsrs_expert1_typical() {
        let result = fsrs_expert1(10.0, 5.0);
        assert!((result - 1.55242464501152).abs() < 1e-10);
    }

    #[test]
    fn fsrs_expert1_zero_stability() {
        assert_eq!(fsrs_expert1(10.0, 0.0), 0.0);
    }

    #[test]
    fn fsrs_expert1_zero_time_returns_s() {
        // t=0: activation check passes (0 < 0.9286 && 0 < 5.0), ratio = S/(S+0) = 1
        assert!((fsrs_expert1(0.0, 5.0) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn fsrs_expert2_decreasing() {
        let result = fsrs_expert2(20.0, 5.0);
        assert!((result - 0.782986721680384).abs() < 1e-10);
        assert!(result < 1.0); // proper forgetting curve, bounded
    }

    #[test]
    fn fsrs_expert2_zero_time() {
        assert_eq!(fsrs_expert2(0.0, 5.0), 0.0);
    }

    #[test]
    fn fsrs_expert2_typical() {
        assert!((fsrs_expert2(5.0, 3.0) - 0.861492369224294).abs() < 1e-10);
    }

    #[test]
    fn fsrs_expert3_equal_time_stability() {
        let result = fsrs_expert3(5.0, 5.0);
        assert!((result - 0.929572632390522).abs() < 1e-10);
    }

    #[test]
    fn fsrs_expert3_zero_time() {
        assert_eq!(fsrs_expert3(0.0, 5.0), 0.0);
    }

    #[test]
    fn fsrs_expert3_typical() {
        assert!((fsrs_expert3(5.0, 3.0) - 0.885398703912691).abs() < 1e-10);
    }

    #[test]
    fn fsrs_expert_mixture_typical() {
        let result = fsrs_expert_mixture(5.0, 3.0);
        assert!((result - 0.959164178214662).abs() < 1e-10);
    }

    #[test]
    fn fsrs_expert_mixture_zero_time() {
        let result = fsrs_expert_mixture(0.0, 3.0);
        assert!((result - 1.51109857732188).abs() < 1e-10);
    }

    // --- FSRS update function tests ---

    #[test]
    fn fsrs_difficulty_update_success() {
        let result = fsrs_difficulty_update(0.5, 5.0, 0.8, 4);
        assert!((result - 0.309995863953117).abs() < 1e-10);
    }

    #[test]
    fn fsrs_difficulty_update_lapse() {
        let result = fsrs_difficulty_update(0.5, 5.0, 0.8, 1);
        assert!((result - 1.0).abs() < 1e-10);
    }

    #[test]
    fn fsrs_lapse_stability_reference() {
        let result = fsrs_lapse_stability(0.5, 10.0, 0.6);
        assert!((result - 9.23561795223687).abs() < 1e-8);
    }

    #[test]
    fn fsrs_recall_stability_reference() {
        let result = fsrs_recall_stability(0.3, 5.0, 0.8, 3.0, 4);
        assert!((result - 28.1462978187137).abs() < 1e-8);
    }

    #[test]
    fn fsrs_recall_stability_early_review() {
        let result = fsrs_recall_stability(0.3, 5.0, 0.8, 2.0, 3);
        assert!((result - 24.1291151309604).abs() < 1e-8);
    }

    // --- FSRS review kernel tests ---

    #[test]
    fn fsrs_kernel_lapse_path() {
        let (s_new, d_new, interval, easiness) = fsrs_review_kernel(5.0, 0.3, 5.0, 1);
        assert!((s_new - 8.25553717907111).abs() < 1e-8);
        assert!((d_new - 1.0).abs() < 1e-8);
        assert!((interval - 8.25553717907111).abs() < 1e-8);
        assert!((easiness - 1.65110743581422).abs() < 1e-8);
    }

    #[test]
    fn fsrs_kernel_recall_path() {
        let (s_new, d_new, interval, easiness) = fsrs_review_kernel(5.0, 0.3, 3.0, 4);
        assert!((s_new - 9.44504365807168).abs() < 1e-8);
        assert!((d_new - 1.0).abs() < 1e-8);
        assert!((interval - 9.44504365807168).abs() < 1e-8);
        assert!((easiness - 1.88900873161434).abs() < 1e-8);
    }

    // --- FSRS init item tests ---

    #[test]
    fn fsrs_init_item_grade3_no_flag() {
        let state = fsrs_init_item(3, 1.0, false);
        assert_eq!(state.algorithm_branch, 1);
        assert!((state.difficulty - FSRS_PARAMS[8]).abs() < 1e-10);
        assert!((state.s_factor - FSRS_PARAMS[14]).abs() < 1e-10);
        assert!((state.multiplier - 3.0).abs() < 1e-10);
        assert!((state.retrov - FSRS_PARAMS[8]).abs() < 1e-10);
    }

    #[test]
    fn fsrs_init_item_grade5_with_flag() {
        let state = fsrs_init_item(5, 2.0, true);
        assert_eq!(state.algorithm_branch, 1);
        assert!((state.difficulty - FSRS_PARAMS[10]).abs() < 1e-10);
        assert!((state.s_factor - FSRS_PARAMS[16]).abs() < 1e-10);
        assert!((state.multiplier - 0.5).abs() < 1e-10);
    }

    // --- Backward compatibility tests ---

    #[test]
    fn sm20_state_backward_compat_deserialize() {
        let old_json = r#"{"version":2,"stability":5.0,"difficulty":0.3,"repetition":3,"lapses":0,"interval":5.0,"last_quality":0.78}"#;
        let state: SM20State = serde_json::from_str(old_json).unwrap();
        assert_eq!(state.version, 2);
        assert!((state.stability - 5.0).abs() < 1e-10);
        assert_eq!(state.algorithm_branch, 0);
        assert!((state.s_factor - 1.0).abs() < 1e-10);
        assert!((state.multiplier - 1.0).abs() < 1e-10);
    }

    #[test]
    fn fsrs_params_count() {
        assert_eq!(FSRS_PARAMS.len(), 35);
        assert!((FSRS_PARAMS[0] - 0.9286298950420208).abs() < 1e-15);
    }
}
