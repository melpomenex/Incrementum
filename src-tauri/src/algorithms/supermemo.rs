//! SuperMemo algorithms implementation
//!
//! Implements various SuperMemo algorithms:
//! - SM-2 (the classic algorithm)
//! - SM-5 (improved version)
//! - SM-8 (with optimal intervals)
//! - SM-15 (modern implementation)

use crate::models::ReviewRating;
use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration};

/// SM-2 algorithm state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SM2State {
    /// Ease factor (minimum 1.3)
    pub ease_factor: f64,
    /// Interval in days
    pub interval: f64,
    /// Number of successful repetitions
    pub repetitions: u32,
}

impl Default for SM2State {
    fn default() -> Self {
        Self {
            ease_factor: 2.5,
            interval: 0.0,
            repetitions: 0,
        }
    }
}

/// SM-2 algorithm
pub struct SM2Algorithm {
    min_ease_factor: f64,
}

impl Default for SM2Algorithm {
    fn default() -> Self {
        Self::new()
    }
}

impl SM2Algorithm {
    pub fn new() -> Self {
        Self {
            min_ease_factor: 1.3,
        }
    }

    /// Calculate next state after review
    pub fn next_state(&self, state: &SM2State, rating: ReviewRating) -> SM2State {
        // Map our rating to SM-2 quality (0-5 scale)
        let quality = match rating {
            ReviewRating::Again => 0,  // Complete blackout
            ReviewRating::Hard => 3,   // Hard with correct response
            ReviewRating::Good => 4,   // Good response
            ReviewRating::Easy => 5,   // Perfect response
        };

        let mut new_state = state.clone();

        if quality < 3 {
            // Failed review - reset
            new_state.repetitions = 0;
            new_state.interval = 0.0;
        } else {
            // Successful review
            new_state.repetitions += 1;

            // Calculate interval based on repetition number
            new_state.interval = match new_state.repetitions {
                1 => 1.0,
                2 => 6.0,
                _ => state.interval * state.ease_factor,
            };

            // Update ease factor
            // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
            let ef_update = 0.1 - (5.0 - quality as f64) * (0.08 + (5.0 - quality as f64) * 0.02);
            new_state.ease_factor = (state.ease_factor + ef_update).max(self.min_ease_factor);
        }

        new_state
    }

    /// Get next interval in days
    pub fn next_interval(&self, state: &SM2State) -> i32 {
        state.interval.max(0.0).round() as i32
    }

    /// Calculate next review date
    pub fn next_review_date(&self, state: &SM2State) -> chrono::DateTime<Utc> {
        let days = self.next_interval(state) as i64;
        Utc::now() + Duration::days(days)
    }
}

/// SM-5 algorithm state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SM5State {
    /// Ease factor
    pub ease_factor: f64,
    /// Current interval
    pub interval: f64,
    /// Number of repetitions
    pub repetitions: u32,
    /// Modified factor for SM-5
    pub modifier: f64,
}

impl Default for SM5State {
    fn default() -> Self {
        Self {
            ease_factor: 2.5,
            interval: 0.0,
            repetitions: 0,
            modifier: 1.0,
        }
    }
}

/// SM-5 algorithm (improved SM-2)
pub struct SM5Algorithm {
    min_ease_factor: f64,
}

impl Default for SM5Algorithm {
    fn default() -> Self {
        Self::new()
    }
}

impl SM5Algorithm {
    pub fn new() -> Self {
        Self {
            min_ease_factor: 1.3,
        }
    }

    pub fn next_state(&self, state: &SM5State, rating: ReviewRating) -> SM5State {
        let quality = match rating {
            ReviewRating::Again => 0,
            ReviewRating::Hard => 3,
            ReviewRating::Good => 4,
            ReviewRating::Easy => 5,
        };

        let mut new_state = state.clone();

        if quality < 3 {
            new_state.repetitions = 0;
            new_state.interval = 0.0;
        } else {
            new_state.repetitions += 1;

            // SM-5 uses modifier for better interval calculation
            new_state.interval = match new_state.repetitions {
                1 => 1.0 * state.modifier,
                2 => 6.0 * state.modifier,
                _ => state.interval * state.ease_factor * state.modifier,
            };

            // Update ease factor (same as SM-2)
            let ef_update = 0.1 - (5.0 - quality as f64) * (0.08 + (5.0 - quality as f64) * 0.02);
            new_state.ease_factor = (state.ease_factor + ef_update).max(self.min_ease_factor);

            // Update modifier based on performance
            new_state.modifier = match quality {
                5 => state.modifier * 1.1,  // Easy - increase future intervals
                4 => state.modifier,
                3 => state.modifier * 0.9,  // Hard - decrease future intervals
                _ => state.modifier * 0.8,
            };

            // Keep modifier in reasonable range
            new_state.modifier = new_state.modifier.clamp(0.5, 2.0);
        }

        new_state
    }

    pub fn next_interval(&self, state: &SM5State) -> i32 {
        state.interval.max(0.0).round() as i32
    }
}

/// SM-8 algorithm with optimal intervals
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SM8State {
    pub ease_factor: f64,
    pub interval: f64,
    pub repetitions: u32,
    /// Lapses count
    pub lapses: u32,
}

impl Default for SM8State {
    fn default() -> Self {
        Self {
            ease_factor: 2.5,
            interval: 0.0,
            repetitions: 0,
            lapses: 0,
        }
    }
}

/// SM-8 algorithm
pub struct SM8Algorithm {
    min_ease_factor: f64,
}

impl Default for SM8Algorithm {
    fn default() -> Self {
        Self::new()
    }
}

impl SM8Algorithm {
    pub fn new() -> Self {
        Self {
            min_ease_factor: 1.3,
        }
    }

    pub fn next_state(&self, state: &SM8State, rating: ReviewRating) -> SM8State {
        let quality = match rating {
            ReviewRating::Again => 0,
            ReviewRating::Hard => 3,
            ReviewRating::Good => 4,
            ReviewRating::Easy => 5,
        };

        let mut new_state = state.clone();

        if quality < 3 {
            // Failed - reset with penalty for lapses
            new_state.repetitions = 0;
            new_state.interval = 0.0;
            new_state.lapses += 1;

            // Reduce ease factor slightly on lapse
            new_state.ease_factor = (state.ease_factor - 0.2).max(self.min_ease_factor);
        } else {
            // Successful
            new_state.repetitions += 1;

            // SM-8 uses optimal intervals: 1, 2, 4, 7, 12, 20, 34, ...
            let optimal_intervals = [1.0, 2.0, 4.0, 7.0, 12.0, 20.0, 34.0, 57.0, 95.0, 158.0];
            let rep_index = (new_state.repetitions as usize).saturating_sub(1);

            new_state.interval = if rep_index < optimal_intervals.len() {
                optimal_intervals[rep_index] * state.ease_factor
            } else {
                state.interval * state.ease_factor
            };

            // Update ease factor
            let ef_update = 0.1 - (5.0 - quality as f64) * (0.08 + (5.0 - quality as f64) * 0.02);
            new_state.ease_factor = (state.ease_factor + ef_update).max(self.min_ease_factor);
        }

        new_state
    }

    pub fn next_interval(&self, state: &SM8State) -> i32 {
        state.interval.max(0.0).round() as i32
    }
}

/// SM-15 algorithm (modern SuperMemo)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SM15State {
    pub stability: f64,
    pub difficulty: f64,
}

impl Default for SM15State {
    fn default() -> Self {
        Self {
            stability: 0.0,
            difficulty: 5.0,
        }
    }
}

/// SM-15 algorithm (simplified modern version)
pub struct SM15Algorithm {
    request_retention: f64,
}

impl Default for SM15Algorithm {
    fn default() -> Self {
        Self::new()
    }
}

impl SM15Algorithm {
    pub fn new() -> Self {
        Self {
            request_retention: 0.9,
        }
    }

    pub fn next_state(&self, state: &SM15State, rating: ReviewRating) -> SM15State {
        let _rating_value = match rating {
            ReviewRating::Again => 1,
            ReviewRating::Hard => 2,
            ReviewRating::Good => 3,
            ReviewRating::Easy => 4,
        };

        // Simplified SM-15 formulas
        let stability_factor = match rating {
            ReviewRating::Again => 0.5,
            ReviewRating::Hard => 0.8,
            ReviewRating::Good => 1.2,
            ReviewRating::Easy => 1.5,
        };

        let difficulty_factor = match rating {
            ReviewRating::Again => 0.2,
            ReviewRating::Hard => 0.1,
            ReviewRating::Good => 0.0,
            ReviewRating::Easy => -0.1,
        };

        let new_stability = if state.stability == 0.0 {
            // First review
            match rating {
                ReviewRating::Again => 0.5,
                ReviewRating::Hard => 1.0,
                ReviewRating::Good => 2.0,
                ReviewRating::Easy => 4.0,
            }
        } else {
            state.stability * stability_factor
        };

        let new_difficulty = (state.difficulty + difficulty_factor).clamp(1.0, 10.0);

        SM15State {
            stability: new_stability.max(0.1),
            difficulty: new_difficulty,
        }
    }

    pub fn next_interval(&self, state: &SM15State) -> i32 {
        // Similar to FSRS, use stability to calculate interval
        let stability_ratio = (self.request_retention.ln() / 0.9_f64.ln()).abs();
        (state.stability * stability_ratio).round() as i32
    }
}

// ============================================================
// SM-18 Algorithm (reverse-engineered from sm18.exe)
// ============================================================

/// SM-18 item state — stores the full per-item algorithm state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SM18State {
    /// Difficulty D ∈ [0, 1]
    pub difficulty: f64,
    /// Memory stability S in days
    pub stability: f64,
    /// Current interval in days
    pub interval: f64,
    /// Repetition counter (resets on lapse)
    pub repetition: u32,
    /// Number of lapses (failures)
    pub lapses: u32,
}

impl Default for SM18State {
    fn default() -> Self {
        Self {
            difficulty: 0.5,
            stability: 0.0,
            interval: 0.0,
            repetition: 0,
            lapses: 0,
        }
    }
}

/// SM-18 constants — exact values from sm18.exe decompilation.
mod sm18_constants {
    pub const SUCCESS_GRADE: i32 = 3;
    pub const DEFAULT_FI: f64 = 0.10;
    pub const STARTUP_STABILITY: f64 = 1.2;
    pub const STARTUP_INTERVAL: f64 = 6.9;
    pub const POST_LAPSE_STABILITY_MOD: f64 = 0.87;
    pub const POST_LAPSE_INTERVAL: f64 = 2.4;
    pub const BGW: f64 = 0.70;
    pub const DEFAULT_SINC: f64 = 0.07;
    pub const DEFAULT_DIFFICULTY: f64 = 0.5;
    pub const MIN_LOG_CLAMP: f64 = -2.125;

    /// Grade-to-retrievability mapping (SM-18 grades 0–5).
    pub fn default_grade_r(grade: i32) -> f64 {
        match grade {
            0 => 0.0,
            1 => 0.0,
            2 => 0.0,
            3 => 0.9,
            4 => 0.95,
            5 => 0.99,
            _ => 0.9,
        }
    }

    /// SInc lookup from in-memory 21³ matrix (D×441 + S×21 + R).
    /// Returns the default SInc when no matrix is loaded.
    pub fn sinc_lookup(_d_bin: usize, _s_bin: usize, _r_bin: usize) -> f64 {
        // In a full implementation, this would index into a 9261-element
        // flat array loaded from StabilityIncrease.dat.
        // For now, return the default SInc.
        DEFAULT_SINC
    }
}

/// Result of an SM-18 review.
#[derive(Debug, Clone)]
pub struct SM18ReviewResult {
    /// Updated item state
    pub state: SM18State,
    /// New interval in days
    pub interval_days: f64,
    /// Retrieval probability before the review
    pub retrievability: f64,
    /// The SInc factor applied to stability
    pub sinc_used: f64,
}

/// SM-18 algorithm.
pub struct SM18Algorithm {
    /// Requested retention (FI) — default 0.90
    pub request_retention: f64,
}

impl Default for SM18Algorithm {
    fn default() -> Self {
        Self::new()
    }
}

impl SM18Algorithm {
    pub fn new() -> Self {
        Self {
            request_retention: sm18_constants::DEFAULT_FI,
        }
    }

    /// Map app `ReviewRating` to SM-18 grade (0–5).
    ///
    /// - Again → 0 (failure / lapse)
    /// - Hard  → 2 (success, low grade)
    /// - Good  → 3 (success, normal)
    /// - Easy  → 5 (success, high grade)
    pub fn rating_to_grade(rating: ReviewRating) -> i32 {
        match rating {
            ReviewRating::Again => 0,
            ReviewRating::Hard => 2,
            ReviewRating::Good => 3,
            ReviewRating::Easy => 5,
        }
    }

    /// Compute retrievability: R(t) = 0.9^(t/S).
    pub fn retrievability(stability: f64, elapsed_days: f64) -> f64 {
        use sm18_constants::*;
        if stability <= 0.0 {
            return 0.0;
        }
        if elapsed_days <= 0.0 {
            return 1.0;
        }
        0.9_f64.powf(elapsed_days / stability)
    }

    /// Solve for interval: 0.9^(interval/S) = 1 - FI → interval = S * ln(1-FI)/ln(0.9).
    pub fn interval_from_stability(stability: f64, fi: f64) -> f64 {
        if stability <= 0.0 || fi <= 0.0 || fi >= 1.0 {
            return 0.0;
        }
        stability * (1.0 - fi).ln() / 0.9_f64.ln()
    }

    /// Compute BW (B-W metric) for deviation tracking.
    fn compute_bw(grade: i32, r: f64, grade_r: f64) -> f64 {
        use sm18_constants::SUCCESS_GRADE;
        if grade >= SUCCESS_GRADE {
            grade_r - r
        } else {
            -r
        }
    }

    /// Compute deviation metric: BGW * fDev + (1-BGW) * |gDev|.
    fn compute_deviation(grade: i32, r: f64, grade_r: f64) -> f64 {
        use sm18_constants::*;
        let f_dev = if grade >= SUCCESS_GRADE { 1.0 - r } else { r };
        let g_dev = grade_r - r;
        BGW * f_dev + (1.0 - BGW) * g_dev.abs()
    }

    /// Convert BW to difficulty: BW=+0.1→D=0.0, BW=-0.9→D=1.0.
    fn bw_to_difficulty(bw: f64) -> f64 {
        (0.1 - bw).clamp(0.0, 1.0)
    }

    /// Update difficulty using trailing average:
    /// D_new = f * RepDiff + (1-f) * D_old, f = max(0.10, 0.80 - (rep-1)*0.06).
    fn update_difficulty(d_old: f64, bw: f64, rep_no: u32) -> f64 {
        let rep_diff = Self::bw_to_difficulty(bw);
        let f = (0.80 - (rep_no as f64 - 1.0) * 0.06).max(0.10);
        (f * rep_diff + (1.0 - f) * d_old).clamp(0.0, 1.0)
    }

    /// Bin difficulty D ∈ [0,1] to grade [1,20].
    fn bin_d_grade(d: f64) -> usize {
        let grade = (d * 19.0) as i32 + 1;
        (grade.clamp(1, 20)) as usize
    }

    /// Bin stability S to grade [1,20] using log-spaced boundaries.
    fn bin_s_grade(s: f64) -> usize {
        if s <= 0.0 {
            return 1;
        }
        const BOUNDARIES: [f64; 20] = [
            1.0, 1.5, 2.0, 3.0, 4.5, 6.5, 9.5, 14.0, 20.0, 29.0,
            42.0, 61.0, 89.0, 129.0, 188.0, 273.0, 396.0, 575.0, 835.0, 1212.0,
        ];
        if s <= BOUNDARIES[0] {
            return 1;
        }
        for i in 0..19 {
            if s <= BOUNDARIES[i + 1] {
                return i + 2;
            }
        }
        20
    }

    /// Bin retrievability R ∈ (0,1] to grade [1,20].
    fn bin_r_grade(r: f64) -> usize {
        if r >= 1.0 {
            return 1;
        }
        let one_minus_r = 1.0 - r;
        let grade = (one_minus_r * 19.0) as i32 + 1;
        (grade.clamp(1, 20)) as usize
    }

    /// Process a review and return updated state.
    ///
    /// # Arguments
    /// * `state` — current SM-18 item state
    /// * `rating` — the user's rating (Again/Hard/Good/Easy)
    /// * `elapsed_days` — days since last review
    pub fn review(&self, state: &SM18State, rating: ReviewRating, elapsed_days: f64) -> SM18ReviewResult {
        use sm18_constants::*;

        let grade = Self::rating_to_grade(rating);
        let mut new_state = state.clone();

        // Step 1: Compute retrievability
        let r = if state.stability > 0.0 && elapsed_days > 0.0 {
            Self::retrievability(state.stability, elapsed_days).clamp(0.0, 1.0)
        } else {
            1.0
        };

        // Step 2: Grade-to-R
        let grade_r = default_grade_r(grade);

        // Step 3: BW and deviation
        let bw = Self::compute_bw(grade, r, grade_r);
        let _dev = Self::compute_deviation(grade, r, grade_r);

        let sinc_used: f64;

        if grade < SUCCESS_GRADE {
            // === FAILURE / LAPSE PATH ===
            new_state.lapses += 1;
            new_state.stability = (state.stability * POST_LAPSE_STABILITY_MOD
                / (1.0 + 0.1 * new_state.lapses as f64))
                .max(0.5);
            new_state.interval = POST_LAPSE_INTERVAL.max(1.0);
            new_state.repetition = 0;
            sinc_used = POST_LAPSE_STABILITY_MOD;
        } else {
            // === SUCCESS PATH ===
            new_state.repetition += 1;

            if new_state.repetition == 1 && state.stability <= 0.0 {
                // First successful review of a new item
                new_state.stability = STARTUP_STABILITY;
                new_state.interval = STARTUP_INTERVAL;
                sinc_used = STARTUP_STABILITY; // marker, not a real SInc
            } else {
                // Compute bin indices
                let d_grade = Self::bin_d_grade(new_state.difficulty);
                let s_grade = Self::bin_s_grade(new_state.stability);
                let r_grade = Self::bin_r_grade(r);

                // SInc lookup — uses the in-memory matrix or default
                sinc_used = sinc_lookup(d_grade - 1, s_grade - 1, r_grade - 1);

                // Update stability: S_new = S_old × SInc
                if sinc_used > 0.0 {
                    new_state.stability = state.stability * sinc_used;
                }

                // Compute new interval from stability
                new_state.interval = Self::interval_from_stability(new_state.stability, self.request_retention);
            }
        }

        // Step 4: Update difficulty
        new_state.difficulty = Self::update_difficulty(
            state.difficulty,
            bw,
            new_state.repetition,
        );

        SM18ReviewResult {
            interval_days: new_state.interval,
            retrievability: r,
            sinc_used,
            state: new_state,
        }
    }

    /// Convenience: get next interval in whole days.
    pub fn next_interval(&self, state: &SM18State) -> i32 {
        state.interval.max(0.0).round() as i32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sm2_basic() {
        let algorithm = SM2Algorithm::new();
        let state = SM2State::default();

        // Good rating should advance repetitions
        let next = algorithm.next_state(&state, ReviewRating::Good);
        assert_eq!(next.repetitions, 1);
        assert_eq!(next.interval, 1.0);

        // Another good rating
        let next2 = algorithm.next_state(&next, ReviewRating::Good);
        assert_eq!(next2.repetitions, 2);
        assert_eq!(next2.interval, 6.0);
    }

    #[test]
    fn test_sm2_failure() {
        let algorithm = SM2Algorithm::new();
        let state = SM2State {
            ease_factor: 2.5,
            interval: 10.0,
            repetitions: 5,
        };

        // Again rating should reset
        let next = algorithm.next_state(&state, ReviewRating::Again);
        assert_eq!(next.repetitions, 0);
        assert_eq!(next.interval, 0.0);
    }

    #[test]
    fn test_sm5_modifier() {
        let algorithm = SM5Algorithm::new();
        let state = SM5State::default();

        // Easy rating should increase modifier
        let next = algorithm.next_state(&state, ReviewRating::Easy);
        assert!(next.modifier > 1.0);

        // Hard rating should decrease modifier
        let next2 = algorithm.next_state(&next, ReviewRating::Hard);
        assert!(next2.modifier < next.modifier);
    }

    #[test]
    fn test_sm15_initial() {
        let algorithm = SM15Algorithm::new();
        let state = SM15State::default();

        let next = algorithm.next_state(&state, ReviewRating::Good);
        assert!(next.stability > 0.0);
        assert!(next.difficulty > 0.0);
    }

    // --- SM-18 tests ---

    #[test]
    fn test_sm18_retrievability() {
        // R(t=S=10) should be exactly 0.9
        let r = SM18Algorithm::retrievability(10.0, 10.0);
        assert!((r - 0.9).abs() < 1e-10);

        // R at t=0 should be 1.0
        assert_eq!(SM18Algorithm::retrievability(5.0, 0.0), 1.0);

        // R with zero stability should be 0.0
        assert_eq!(SM18Algorithm::retrievability(0.0, 5.0), 0.0);
    }

    #[test]
    fn test_sm18_interval_from_stability() {
        // At FI=0.10, interval == stability
        let interval = SM18Algorithm::interval_from_stability(10.0, 0.10);
        assert!((interval - 10.0).abs() < 1e-10);
    }

    #[test]
    fn test_sm18_rating_mapping() {
        assert_eq!(SM18Algorithm::rating_to_grade(ReviewRating::Again), 0);
        assert_eq!(SM18Algorithm::rating_to_grade(ReviewRating::Hard), 2);
        assert_eq!(SM18Algorithm::rating_to_grade(ReviewRating::Good), 3);
        assert_eq!(SM18Algorithm::rating_to_grade(ReviewRating::Easy), 5);
    }

    #[test]
    fn test_sm18_first_review() {
        let algo = SM18Algorithm::new();
        let state = SM18State::default(); // stability=0, difficulty=0.5

        let result = algo.review(&state, ReviewRating::Good, 0.0);

        // First review of new item: startup values
        assert!((result.state.stability - 1.2).abs() < 1e-10);
        assert!((result.state.interval - 6.9).abs() < 1e-10);
        assert_eq!(result.state.repetition, 1);
        assert_eq!(result.state.lapses, 0);
    }

    #[test]
    fn test_sm18_lapse() {
        let algo = SM18Algorithm::new();
        let state = SM18State {
            stability: 100.0,
            difficulty: 0.3,
            interval: 100.0,
            repetition: 5,
            lapses: 0,
        };

        let result = algo.review(&state, ReviewRating::Again, 50.0);

        // Lapse: stability drops, lapses increment, repetition resets
        assert!(result.state.stability < 100.0);
        assert_eq!(result.state.lapses, 1);
        assert_eq!(result.state.repetition, 0);
        assert!((result.state.interval - 2.4).abs() < 1e-10);
    }

    #[test]
    fn test_sm18_success_increases_stability() {
        let algo = SM18Algorithm::new();
        let state = SM18State {
            stability: 5.0,
            difficulty: 0.3,
            interval: 5.0,
            repetition: 0,
            lapses: 0,
        };

        // Review on schedule (elapsed == interval), so R ≈ 0.9
        let result = algo.review(&state, ReviewRating::Good, 5.0);

        // Stability should increase after successful review
        assert!(result.state.stability > 5.0);
        assert_eq!(result.state.repetition, 1);
    }

    #[test]
    fn test_sm18_difficulty_clamped() {
        let algo = SM18Algorithm::new();

        // Repeated lapses should push difficulty toward 1.0 but not exceed
        let mut state = SM18State::default();
        for _ in 0..20 {
            let result = algo.review(&state, ReviewRating::Again, 0.0);
            state = result.state;
        }
        assert!(state.difficulty <= 1.0);
        assert!(state.difficulty >= 0.0);
    }
}
