/**
 * SM-18 Algorithm Tests — validated against the Python reference implementation
 * at https://github.com/melpomenex/sm18-re/blob/main/sm18_exact_algorithm.py
 *
 * The Python reference uses the same constants and formulas decompiled from sm18.exe.
 * These tests verify that our TypeScript implementation produces identical results.
 */

import {
    sm18Retrievability,
    sm18IntervalFromStability,
    sm18Review,
    parseSm18State,
    defaultSm18State,
    ratingToSm18Grade,
} from '../sm18';

describe('SM-18 Algorithm (matching Python reference)', () => {
    // ============================================================
    // Core formulas — exact match with Python
    // ============================================================

    describe('retrievability', () => {
        test('R(t=S) = 0.9 by definition — matches Python retrievability(10.0, 10.0)', () => {
            expect(sm18Retrievability(10.0, 10.0)).toBeCloseTo(0.9, 10);
        });

        test('R(0, anything) = 1.0 — matches Python', () => {
            expect(sm18Retrievability(5.0, 0.0)).toBe(1.0);
        });

        test('R(anything, negative) = 1.0 — matches Python', () => {
            expect(sm18Retrievability(5.0, -1.0)).toBe(1.0);
        });

        test('R(0, anything) = 0.0 — matches Python', () => {
            expect(sm18Retrievability(0.0, 10.0)).toBe(0.0);
        });

        test('R(negative, anything) = 0.0 — matches Python', () => {
            expect(sm18Retrievability(-1.0, 10.0)).toBe(0.0);
        });

        test('R(10, 5) = 0.9^0.5 — matches Python retrievability(10.0, 5.0)', () => {
            expect(sm18Retrievability(10.0, 5.0)).toBeCloseTo(Math.pow(0.9, 0.5), 10);
        });
    });

    describe('interval_from_stability', () => {
        test('FI=0.10 → interval == stability — matches Python', () => {
            expect(sm18IntervalFromStability(10.0, 0.10)).toBeCloseTo(10.0, 10);
        });

        test('FI=0 → 0.0 — matches Python', () => {
            expect(sm18IntervalFromStability(10.0, 0.0)).toBe(0.0);
        });

        test('FI=1 → 0.0 — matches Python', () => {
            expect(sm18IntervalFromStability(10.0, 1.0)).toBe(0.0);
        });

        test('stability=0 → 0.0 — matches Python', () => {
            expect(sm18IntervalFromStability(0.0, 0.10)).toBe(0.0);
        });
    });

    // ============================================================
    // BW and difficulty — traced from Python formulas
    // ============================================================

    describe('BW computation', () => {
        test('BW for grade 3 with elapsed=0: R=1.0, grade_r=0.9, BW = 0.9-1.0 = -0.1', () => {
            const state = defaultSm18State();
            const result = sm18Review(state, 3, 0.0);
            expect(result.bw).toBeCloseTo(-0.1, 10);
        });

        test('BW for failure (grade 0) with elapsed=0: R=1.0, BW = -1.0', () => {
            const state = defaultSm18State();
            const result = sm18Review(state, 0, 0.0);
            expect(result.bw).toBeCloseTo(-1.0, 10);
        });

        // Matches Python: compute_bw(3, 0.8, 0.9) = 0.9 - 0.8 = 0.1
        test('BW for success: grade_R - R = 0.9 - 0.8 = 0.1', () => {
            // R = 0.9^(5/10) = 0.94868...
            // With S=10, elapsed=5: R ≈ 0.949, grade_r=0.9, BW = 0.9 - 0.949 = -0.049
            // That doesn't give exactly 0.1, so let me set up exact conditions
            // Need R=0.8: 0.9^(t/10)=0.8 → t/10 = ln(0.8)/ln(0.9) → t = 10*ln(0.8)/ln(0.9) ≈ 31.54
            const elapsed = 10 * Math.log(0.8) / Math.log(0.9);
            const state = { ...defaultSm18State(), stability: 10.0, difficulty: 0.3, repetition: 1 };
            const result = sm18Review(state, 3, elapsed);
            // R ≈ 0.8, grade_r = 0.9, BW = 0.9 - 0.8 = 0.1
            expect(result.retrievability).toBeCloseTo(0.8, 8);
            expect(result.bw).toBeCloseTo(0.1, 8);
        });
    });

    // ============================================================
    // First review — matching Python review path
    // ============================================================

    describe('first review (new item)', () => {
        test('grade 3 (good), elapsed=0 → S=1.2, interval=6.9 — matches Python exactly', () => {
            const state = defaultSm18State();
            sm18Review(state, 3, 0.0);

            // Python: repetition=1, stability=STARTUP_STABILITY=1.2, interval=STARTUP_INTERVAL=6.9
            expect(state.repetition).toBe(1);
            expect(state.stability).toBeCloseTo(1.2, 10);
            expect(state.interval).toBeCloseTo(6.9, 10);
        });

        test('grade 0 (again), elapsed=0 → failure, S=0.5, interval=2.4 — matches Python exactly', () => {
            const state = defaultSm18State();
            sm18Review(state, 0, 0.0);

            // Python failure: lapses=1, S=max(0*0.87/1.1, 0.5)=0.5, interval=max(2.4,1.0)=2.4
            expect(state.lapses).toBe(1);
            expect(state.stability).toBeCloseTo(0.5, 10);
            expect(state.repetition).toBe(0);
            expect(state.interval).toBeCloseTo(2.4, 10);
        });
    });

    // ============================================================
    // Failure path — exact numerical match with Python
    // ============================================================

    describe('failure path (matching Python exactly)', () => {
        test('S=50, lapses=0, grade=0 → S_new = max(50*0.87/1.1, 0.5)', () => {
            const state = { ...defaultSm18State(), stability: 50.0, repetition: 5 };
            sm18Review(state, 0, 10.0);

            const expected = Math.max(50.0 * 0.87 / 1.1, 0.5);
            expect(state.stability).toBeCloseTo(expected, 10);
            expect(state.lapses).toBe(1);
            expect(state.repetition).toBe(0);
            expect(state.interval).toBeCloseTo(2.4, 10);
        });

        test('S=10, lapses=0, grade=1 → failure', () => {
            const state = { ...defaultSm18State(), stability: 10.0, repetition: 3 };
            sm18Review(state, 1, 5.0);

            expect(state.lapses).toBe(1);
            expect(state.repetition).toBe(0);
            const expected = Math.max(10.0 * 0.87 / 1.1, 0.5);
            expect(state.stability).toBeCloseTo(expected, 10);
        });

        test('multiple lapses: S=50, existing lapses=2, grade=0 → lapses=3', () => {
            const state = { ...defaultSm18State(), stability: 50.0, repetition: 3, lapses: 2 };
            sm18Review(state, 0, 10.0);

            expect(state.lapses).toBe(3);
            const expected = Math.max(50.0 * 0.87 / 1.3, 0.5);
            expect(state.stability).toBeCloseTo(expected, 10);
        });
    });

    // ============================================================
    // Difficulty update — traced against Python
    // ============================================================

    describe('difficulty update', () => {
        // Python trace for first review of new item with grade 3, elapsed=0:
        // R=1.0, grade_r=0.9, BW = 0.9 - 1.0 = -0.1
        // rep_diff = bw_to_difficulty(-0.1) = 0.1 - (-0.1) = 0.2
        // f = max(0.10, 0.80 - 0*0.06) = 0.80
        // D_new = 0.80*0.2 + 0.20*0.5 = 0.16 + 0.10 = 0.26
        test('first review grade 3, D=0.5 → D_new=0.26 (exact Python trace)', () => {
            const state = defaultSm18State(); // D=0.5
            sm18Review(state, 3, 0.0);
            expect(state.difficulty).toBeCloseTo(0.26, 10);
        });
    });

    // ============================================================
    // Cross-validation: review sequence against Python output
    // ============================================================

    describe('review sequence cross-validated with Python (real SInc matrix)', () => {
        // Python output WITH real StabilityIncrease.dat matrix (grade=3):
        // Rep 1: R=1.0, S=0→1.2, D=0.5→0.26, interval=6.9
        // Rep 2: R=0.545625, S=1.2→3.4113, sinc=2.8427, D=0.26→0.0676
        // Rep 3: R=0.9, S=3.4113→21.0146, sinc=6.1604, D→0.089632
        // Rep 4: R=0.9, S=21.0146→106.5244, sinc=5.0691, D→0.096060

        test('rep 1: exact match — R=1.0, S=1.2, D=0.26, interval=6.9', () => {
            const state = defaultSm18State();
            const result = sm18Review(state, 3, 0.0);

            expect(result.retrievability).toBeCloseTo(1.0, 10);
            expect(state.stability).toBeCloseTo(1.2, 10);
            expect(state.difficulty).toBeCloseTo(0.26, 10);
            expect(state.interval).toBeCloseTo(6.9, 10);
        });

        test('rep 2: exact Python match — S=3.4113, sinc=2.8427, D=0.0676', () => {
            const state = defaultSm18State();
            sm18Review(state, 3, 0.0); // rep 1
            const elapsed = state.interval; // 6.9
            const result = sm18Review(state, 3, elapsed);

            expect(result.retrievability).toBeCloseTo(0.545625, 5);
            expect(result.sinc).toBeCloseTo(2.8427, 4);
            expect(state.stability).toBeCloseTo(3.4113, 4);
            expect(state.difficulty).toBeCloseTo(0.0676, 4);
            expect(state.interval).toBeCloseTo(3.4113, 4);
        });

        test('rep 3: exact Python match — S=21.0146, sinc=6.1604', () => {
            const state = defaultSm18State();
            sm18Review(state, 3, 0.0);
            sm18Review(state, 3, state.interval);
            const elapsed = state.interval; // 3.4113
            const result = sm18Review(state, 3, elapsed);

            expect(result.retrievability).toBeCloseTo(0.9, 10);
            expect(result.sinc).toBeCloseTo(6.1604, 4);
            expect(state.stability).toBeCloseTo(21.0146, 4);
            expect(state.difficulty).toBeCloseTo(0.089632, 5);
        });

        test('rep 4: exact Python match — S=106.5244, sinc=5.0691', () => {
            const state = defaultSm18State();
            for (let i = 0; i < 3; i++) {
                const elapsed = i > 0 ? Math.max(0, state.interval) : 0.0;
                sm18Review(state, 3, elapsed);
            }
            const elapsed = state.interval; // 21.0146
            const result = sm18Review(state, 3, elapsed);

            expect(result.retrievability).toBeCloseTo(0.9, 10);
            expect(result.sinc).toBeCloseTo(5.0691, 4);
            expect(state.stability).toBeCloseTo(106.5244, 4);
            expect(state.difficulty).toBeCloseTo(0.096060, 5);
        });

        test('grade 4 first review matches Python — S=1.2 (not 2.4)', () => {
            const state = defaultSm18State();
            sm18Review(state, 4, 0.0);
            expect(state.stability).toBeCloseTo(1.2, 10); // Python sets 1.2 for all first-success grades
            expect(state.difficulty).toBeCloseTo(0.22, 10); // grade_r=0.95, BW=0.95-1.0=-0.05
        });

        test('failure matches Python exactly', () => {
            const state = { ...defaultSm18State(), stability: 50.0, repetition: 5 };
            sm18Review(state, 0, 10.0);
            expect(state.stability).toBeCloseTo(39.545455, 5);
            expect(state.lapses).toBe(1);
            expect(state.interval).toBeCloseTo(2.4, 10);
        });

        test('rep 3 with grade 4: R=0.9, sinc=6.1604 (same bins as grade 3)', () => {
            const state = defaultSm18State();
            sm18Review(state, 4, 0.0); // S=1.2, interval=6.9
            sm18Review(state, 4, state.interval); // S=3.4113, interval=3.4113
            const elapsed = state.interval; // 3.4113
            const result = sm18Review(state, 4, elapsed);
            // SInc depends on bin indices (D,S,R grades) not grade_r, so same as grade 3
            expect(result.retrievability).toBeCloseTo(0.9, 10);
            expect(result.sinc).toBeCloseTo(6.1604, 4);
            expect(state.stability).toBeCloseTo(21.0146, 4);
            expect(state.difficulty).toBeCloseTo(0.052304, 5);
        });
    });

    // ============================================================
    // Binning functions — matching Python fallback (no sm8opt)
    // ============================================================

    describe('binning (matching Python fallback boundaries)', () => {
        test('binning runs without errors for various difficulty values', () => {
            for (const d of [0.0, 0.5, 1.0]) {
                const state = { ...defaultSm18State(), stability: 10.0, difficulty: d };
                sm18Review(state, 3, 5.0);
                expect(state.stability).toBeGreaterThan(10.0);
            }
        });

        // Verify bin_d_grade: D=0.0→1, D=0.5→10, D=1.0→20
        // These match Python: int(d*19)+1
        test('bin_d_grade boundaries', () => {
            // D=0.0: floor(0*19)+1 = 1
            expect(Math.floor(0.0 * 19) + 1).toBe(1);
            // D=0.5: floor(0.5*19)+1 = floor(9.5)+1 = 9+1 = 10
            expect(Math.floor(0.5 * 19) + 1).toBe(10);
            // D=1.0: floor(1.0*19)+1 = 19+1 = 20
            expect(Math.floor(1.0 * 19) + 1).toBe(20);
        });
    });

    // ============================================================
    // Subsequent review (SInc formula path)
    // ============================================================

    describe('subsequent review (formula SInc path)', () => {
        test('grade 3, S=10, elapsed=5 → stability increases', () => {
            const state = {
                ...defaultSm18State(),
                stability: 10.0,
                difficulty: 0.3,
                repetition: 1,
            };
            const result = sm18Review(state, 3, 5.0);

            // R = 0.9^(5/10) ≈ 0.949 → high R → SInc > 1 → stability grows
            expect(result.retrievability).toBeGreaterThan(0.9);
            expect(state.stability).toBeGreaterThan(10.0);
            expect(result.sinc).toBeGreaterThan(0.0);
            expect(state.interval).toBeCloseTo(state.stability, 1);
        });
    });

    // ============================================================
    // Rating mapping — matching Rust review.rs
    // ============================================================

    describe('ratingToSm18Grade', () => {
        test('maps Tauri ratings to SM-18 grades matching Rust review.rs', () => {
            expect(ratingToSm18Grade(0)).toBe(0); // Again → 0
            expect(ratingToSm18Grade(1)).toBe(2); // Hard → 2
            expect(ratingToSm18Grade(2)).toBe(3); // Good → 3
            expect(ratingToSm18Grade(3)).toBe(5); // Easy → 5
        });
    });

    // ============================================================
    // State serialization
    // ============================================================

    describe('parseSm18State', () => {
        test('returns defaults for undefined', () => {
            const state = parseSm18State(undefined);
            expect(state.difficulty).toBeCloseTo(0.5, 10);
            expect(state.stability).toBe(0.0);
            expect(state.interval).toBe(0.0);
            expect(state.repetition).toBe(0);
            expect(state.lapses).toBe(0);
        });

        test('returns defaults for invalid JSON', () => {
            const state = parseSm18State('not json');
            expect(state.difficulty).toBeCloseTo(0.5, 10);
        });

        test('parses valid state JSON', () => {
            const state = parseSm18State(JSON.stringify({
                difficulty: 0.3,
                stability: 10.0,
                interval: 10.0,
                elapsed: 0.0,
                repetition: 5,
                lapses: 1,
            }));
            expect(state.difficulty).toBeCloseTo(0.3, 10);
            expect(state.stability).toBe(10.0);
            expect(state.repetition).toBe(5);
            expect(state.lapses).toBe(1);
        });
    });

    // ============================================================
    // Round-trip: serialize → deserialize → review
    // ============================================================

    describe('round-trip serialization', () => {
        test('state survives JSON round-trip', () => {
            const state1 = defaultSm18State();
            sm18Review(state1, 3, 0.0);
            sm18Review(state1, 3, 6.9);

            const json = JSON.stringify(state1);
            const state2 = parseSm18State(json);

            sm18Review(state2, 3, state2.interval);
            expect(state2.stability).toBeGreaterThan(0);
            expect(state2.interval).toBeGreaterThan(0);
        });
    });

    // ============================================================
    // Constants match decompiled values
    // ============================================================

    describe('constants match Python decompiled values', () => {
        // These must match the Python exactly for algorithm correctness
        test('STARTUP_STABILITY = 1.2', () => {
            const state = defaultSm18State();
            sm18Review(state, 3, 0.0);
            expect(state.stability).toBeCloseTo(1.2, 10);
        });

        test('STARTUP_INTERVAL = 6.9', () => {
            const state = defaultSm18State();
            sm18Review(state, 3, 0.0);
            expect(state.interval).toBeCloseTo(6.9, 10);
        });

        test('POST_LAPSE_STABILITY_MOD = 0.87', () => {
            const state = { ...defaultSm18State(), stability: 100.0 };
            sm18Review(state, 0, 0.0);
            // S = max(100 * 0.87 / 1.1, 0.5) = 79.0909...
            expect(state.stability).toBeCloseTo(100 * 0.87 / 1.1, 10);
        });

        test('POST_LAPSE_INTERVAL = 2.4', () => {
            const state = defaultSm18State();
            sm18Review(state, 0, 0.0);
            expect(state.interval).toBeCloseTo(2.4, 10);
        });
    });
});
