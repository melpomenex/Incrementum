//! SM-20 Algorithm Implementation
//!
//! The interval-growth core follows the reverse-engineered SM-20 V2 matrix prior from `sm20-re`.
//! The review-state update around that core is an app-level approximation that maps the app's
//! four-button review flow onto SM-20's DSR model.

use serde::{Deserialize, Serialize};

const STABILITY_POWER: f64 = 2.90396936502257;
const MIN_STABILITY: f64 = 0.7;
const MAX_STABILITY: f64 = 44530.0;

const C1: f64 = 9.29;
const C2: f64 = 1.3;
const C3: f64 = 1.0;
const C4: f64 = -0.08;
const C5: f64 = -0.31;
const C6: f64 = 1.04;
const C7: f64 = 0.07;
const C8: f64 = -1.88;
const C9: f64 = 1.58;
const C10: f64 = 600.0;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SM20State {
    pub version: u8,
    pub stability: f64,
    pub difficulty: f64,
    pub repetition: u32,
    pub lapses: u32,
    pub interval: f64,
    pub last_quality: f64,
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

fn clamp(value: f64, minimum: f64, maximum: f64) -> f64 {
    value.max(minimum).min(maximum)
}

pub fn retrievability(stability: f64, elapsed_days: f64) -> f64 {
    if !stability.is_finite() || stability <= 0.0 {
        return 0.0;
    }
    0.9_f64.powf(elapsed_days.max(0.0) / stability)
}

fn transformed_stability(stability: f64) -> f64 {
    (stability - 1.0).max(0.0).powf(STABILITY_POWER) + 2.0
}

fn compute_interval_growth(rep_fraction: f64, stability: f64, difficulty: f64) -> f64 {
    let stability_scale = C2 + (C1 - C2) * (C3 - rep_fraction);
    let rep_power = C4 + rep_fraction * (C5 - C4);
    let rep_factor = transformed_stability(stability).powf(rep_power.max(0.001));
    let base = (stability_scale - C6) * rep_factor + C7;
    let penalty = (rep_fraction * C8 + C9).min(C10);
    let exponent = -penalty * clamp(difficulty, 0.0, 1.0);
    base * 2.0_f64.powf(clamp(exponent, -38.0, 38.0))
}

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
    let quality = rating_to_quality(rating);
    let current_retrievability = retrievability(state.stability, elapsed_days);

    if rating <= 1 {
        let lapses = state.lapses + 1;
        let interval_days = lapse_interval(state.stability, lapses);
        let next_state = SM20State {
            version: 2,
            stability: clamp(interval_days, MIN_STABILITY, MAX_STABILITY),
            difficulty: next_difficulty(state.difficulty, quality),
            repetition: 0,
            lapses,
            interval: interval_days,
            last_quality: quality,
        };

        return SM20ReviewResult {
            state: next_state,
            interval_days,
            retrievability: current_retrievability,
        };
    }

    let repetition = (state.repetition + 1).clamp(1, 20);
    let rep_fraction = (repetition as f64 - 1.0) / 19.0;
    let growth = compute_interval_growth(rep_fraction, state.stability, state.difficulty);
    let interval_days =
        clamp((state.stability * growth * success_multiplier(rating)).max(1.0), 1.0, MAX_STABILITY);

    let next_state = SM20State {
        version: 2,
        stability: interval_days,
        difficulty: next_difficulty(state.difficulty, quality),
        repetition,
        lapses: state.lapses,
        interval: interval_days,
        last_quality: quality,
    };

    SM20ReviewResult {
        state: next_state,
        interval_days,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retrievability_uses_ninety_percent_curve() {
        assert!((retrievability(10.0, 10.0) - 0.9).abs() < 1e-10);
    }

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
}
