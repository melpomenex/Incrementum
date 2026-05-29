//! SM-18 SInc Matrix Data Loader
//!
//! This module loads the SINC_MATRIX from an external binary file at compile time
//! using `include_bytes!`, avoiding the compilation and IDE performance issues
//! caused by large inline constant arrays.

use std::sync::OnceLock;

/// The size of the SInc matrix (21^3 = 9261 entries)
pub const SINC_MATRIX_LEN: usize = 9261;

/// SInc matrix dimension (21^3 = 9261 entries, indices 0..20 active, 20 = sentinel)
pub const SINC_DIM: usize = 21;

// Compile-time assertions to verify matrix dimensions
const _: () = assert!(
    SINC_MATRIX_LEN == 9261,
    "SINC_MATRIX_LEN must be exactly 9261"
);
const _: () = assert!(SINC_DIM == 21, "SINC_DIM must be exactly 21");
const _: () = assert!(
    SINC_DIM * SINC_DIM * SINC_DIM == SINC_MATRIX_LEN,
    "SINC_DIM^3 must equal SINC_MATRIX_LEN (21^3 = 9261)"
);

/// Bytes per f64 value
const F64_BYTES: usize = 8;

/// Compile-time embedded binary data
static SINC_MATRIX_BYTES: &[u8] = include_bytes!("../../data/sinc_matrix.bin");

/// Runtime cached matrix (initialized on first access)
static SINC_MATRIX_CACHE: OnceLock<Vec<f64>> = OnceLock::new();

/// Load and cache the SInc matrix.
///
/// This function lazily initializes the matrix from the embedded binary data
/// on first call, then returns a reference to the cached vector.
///
/// # Panics
/// Panics if the binary data is corrupted or has unexpected size.
pub fn get_sinc_matrix() -> &'static [f64] {
    SINC_MATRIX_CACHE.get_or_init(|| {
        // Verify binary size matches expected
        let expected_bytes = SINC_MATRIX_LEN * F64_BYTES;
        assert_eq!(
            SINC_MATRIX_BYTES.len(),
            expected_bytes,
            "SINC_MATRIX binary data size mismatch: expected {} bytes, got {}",
            expected_bytes,
            SINC_MATRIX_BYTES.len()
        );

        // Convert bytes to f64 values (little-endian)
        SINC_MATRIX_BYTES
            .chunks_exact(F64_BYTES)
            .map(|chunk| {
                let arr: [u8; F64_BYTES] = chunk.try_into().expect("Invalid chunk size");
                f64::from_le_bytes(arr)
            })
            .collect()
    })
}

/// Compute flat index for SInc matrix lookup with bounds checking.
///
/// Layout: flat[D * 441 + S * 21 + R] — D slowest, R fastest.
///
/// # Arguments
/// * `d` - Difficulty index (0..20 for active, 20 is sentinel/out of bounds)
/// * `s` - Stability index (0..20 for active, 20 is sentinel/out of bounds)
/// * `r` - Retrievability index (0..20 for active, 20 is sentinel/out of bounds)
///
/// # Returns
/// Some(idx) if indices are valid, None if out of bounds.
pub fn sinc_matrix_index(d: usize, s: usize, r: usize) -> Option<usize> {
    // Validate indices are within valid range (0..20 for active matrix)
    if d >= SINC_DIM || s >= SINC_DIM || r >= SINC_DIM {
        return None;
    }
    let idx = d * 441 + s * 21 + r;
    if idx >= SINC_MATRIX_LEN {
        return None;
    }
    Some(idx)
}

/// Look up a value from the SInc matrix with bounds checking.
///
/// Layout: flat[D * 441 + S * 21 + R] — D slowest, R fastest.
/// Indices 0..19 active, index 20 = sentinel (value 0).
///
/// # Arguments
/// * `d` - Difficulty index (0..=20, where 20 is sentinel)
/// * `s` - Stability index (0..=20, where 20 is sentinel)
/// * `r` - Retrievability index (0..=20, where 20 is sentinel)
///
/// # Returns
/// The SInc factor for the given indices, or DEFAULT_SINC if out of bounds.
pub fn sinc_lookup(d: usize, s: usize, r: usize) -> f64 {
    match sinc_matrix_index(d, s, r) {
        Some(idx) => get_sinc_matrix().get(idx).copied().unwrap_or(DEFAULT_SINC),
        None => DEFAULT_SINC,
    }
}

/// Default SInc when no matrix data (double 0x3fb1eb851eb851ec)
pub const DEFAULT_SINC: f64 = 0.07;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_matrix_size() {
        let matrix = get_sinc_matrix();
        assert_eq!(
            matrix.len(),
            SINC_MATRIX_LEN,
            "Matrix must have exactly {} elements",
            SINC_MATRIX_LEN
        );
    }

    #[test]
    fn test_matrix_dimensions() {
        assert_eq!(SINC_DIM, 21, "SINC_DIM should be 21");
        assert_eq!(
            SINC_DIM * SINC_DIM * SINC_DIM,
            SINC_MATRIX_LEN,
            "21^3 should equal {}",
            SINC_MATRIX_LEN
        );
    }

    #[test]
    fn test_binary_size_matches() {
        let expected_bytes = SINC_MATRIX_LEN * 8; // 8 bytes per f64
        assert_eq!(
            SINC_MATRIX_BYTES.len(),
            expected_bytes,
            "Binary data must be exactly {} bytes",
            expected_bytes
        );
    }

    #[test]
    fn test_first_values() {
        let matrix = get_sinc_matrix();
        // First row values (D=0, S=0, R=0..2)
        assert!(
            (matrix[0] - 14.244807054158343).abs() < 1e-10,
            "matrix[0] should be ~14.2448, got {}",
            matrix[0]
        );
        assert!(
            (matrix[1] - 8.463742430189027).abs() < 1e-10,
            "matrix[1] should be ~8.4637, got {}",
            matrix[1]
        );
        assert!(
            (matrix[2] - 6.241742514560372).abs() < 1e-10,
            "matrix[2] should be ~6.2417, got {}",
            matrix[2]
        );
    }

    #[test]
    fn test_spot_check_row_boundaries() {
        let matrix = get_sinc_matrix();

        // Index 20: First row's sentinel (D=0, S=0, R=20)
        assert_eq!(matrix[20], 0.0, "matrix[20] sentinel should be 0.0");

        // Index 21: Second row start (D=0, S=1, R=0)
        assert!(
            (matrix[21] - 13.822075662290615).abs() < 1e-10,
            "matrix[21] should be ~13.8221, got {}",
            matrix[21]
        );

        // Index 440: End of first D-slice, last valid in S=19, R=19 (D=0, S=19, R=19)
        // This should be a valid non-zero value
        assert!(
            matrix[440] > 0.0,
            "matrix[440] should be positive, got {}",
            matrix[440]
        );

        // Index 441: Start of second D-slice (D=1, S=0, R=0)
        assert!(
            (matrix[441] - 13.523332785305644).abs() < 1e-10,
            "matrix[441] should be ~13.5233, got {}",
            matrix[441]
        );
    }

    #[test]
    fn test_spot_check_d_slice_transitions() {
        let matrix = get_sinc_matrix();

        // Verify D-slice starts are consistent
        // Each D-slice starts at index d * 441
        for d in [0, 1, 5, 10, 15, 19] {
            let idx = d * 441;
            assert!(
                matrix[idx] > 1.0,
                "D-slice {} start (index {}) should be > 1.0, got {}",
                d,
                idx,
                matrix[idx]
            );
        }
    }

    #[test]
    fn test_last_active_elements() {
        let matrix = get_sinc_matrix();
        // Last active element: d=19, s=19, r=19
        let last_active_idx = 19 * 441 + 19 * 21 + 19;
        assert!(
            last_active_idx < SINC_MATRIX_LEN,
            "Last active index {} should be within bounds",
            last_active_idx
        );
        assert!(
            matrix[last_active_idx] > 0.0,
            "Last active element should be positive, got {}",
            matrix[last_active_idx]
        );
    }

    #[test]
    fn test_last_values() {
        let matrix = get_sinc_matrix();
        // Last 21 values should be zeros (final sentinel row: D=20 or S=20, R=0..20)
        for i in (SINC_MATRIX_LEN - 21)..SINC_MATRIX_LEN {
            assert_eq!(matrix[i], 0.0, "Sentinel value at index {} should be 0", i);
        }
    }

    #[test]
    fn test_sentinel_positions() {
        let matrix = get_sinc_matrix();
        // Every 21st element in R dimension (indices 20, 41, 62, ...) should be 0.0
        // These are the sentinel positions within each S-row in the D=0 slice
        for s in 0..20 {
            let idx = s * 21 + 20; // R=20 (sentinel) for each S row in D=0
            assert_eq!(
                matrix[idx], 0.0,
                "Sentinel at S={}, R=20 should be 0.0, got {} at index {}",
                s, matrix[idx], idx
            );
        }
    }

    #[test]
    fn test_no_negative_values() {
        let matrix = get_sinc_matrix();
        // Sample every 100th element to check for negative values
        for i in (0..SINC_MATRIX_LEN).step_by(100) {
            assert!(
                matrix[i] >= 0.0,
                "matrix[{}] should be >= 0.0, got {}",
                i,
                matrix[i]
            );
        }
    }

    #[test]
    fn test_matrix_monotonicity_r_grade() {
        let matrix = get_sinc_matrix();
        // Within a fixed D and S, higher R-grade (lower index) should give higher SInc
        // R=0 (index 0) -> highest retrievability -> highest SInc
        // R=19 (index 19) -> lowest retrievability -> lowest SInc
        let d = 5;
        let s = 10;
        let high_r_idx = d * 441 + s * 21 + 0; // R=0 (best recall)
        let low_r_idx = d * 441 + s * 21 + 19; // R=19 (worst recall)

        assert!(
            matrix[high_r_idx] > matrix[low_r_idx],
            "Higher R should give higher SInc: high_r={}, low_r={}",
            matrix[high_r_idx],
            matrix[low_r_idx]
        );
    }

    #[test]
    fn test_index_bounds_checking() {
        // Valid indices should return Some
        assert_eq!(sinc_matrix_index(0, 0, 0), Some(0));
        assert_eq!(sinc_matrix_index(0, 0, 1), Some(1));
        assert_eq!(sinc_matrix_index(0, 1, 0), Some(21));
        assert_eq!(sinc_matrix_index(1, 0, 0), Some(441));
        assert_eq!(sinc_matrix_index(1, 1, 1), Some(441 + 21 + 1));

        // Sentinel indices (20) should return None (out of bounds)
        assert_eq!(
            sinc_matrix_index(20, 0, 0),
            None,
            "d=20 should be out of bounds"
        );
        assert_eq!(
            sinc_matrix_index(0, 20, 0),
            None,
            "s=20 should be out of bounds"
        );
        assert_eq!(
            sinc_matrix_index(0, 0, 20),
            None,
            "r=20 should be out of bounds"
        );

        // Far out of bounds
        assert_eq!(sinc_matrix_index(25, 10, 10), None);
        assert_eq!(sinc_matrix_index(10, 25, 10), None);
        assert_eq!(sinc_matrix_index(10, 10, 25), None);
    }

    #[test]
    fn test_lookup_bounds() {
        // Out of bounds should return DEFAULT_SINC
        assert_eq!(sinc_lookup(25, 10, 10), DEFAULT_SINC);
        assert_eq!(sinc_lookup(10, 25, 10), DEFAULT_SINC);
        assert_eq!(sinc_lookup(10, 10, 25), DEFAULT_SINC);
        assert_eq!(sinc_lookup(usize::MAX, 10, 10), DEFAULT_SINC);
    }

    #[test]
    fn test_lookup_sentinel() {
        // Index 20 in any dimension should return DEFAULT_SINC (via bounds check)
        // Note: The old implementation returned 0.0 for sentinels,
        // but now sinc_matrix_index returns None for index 20
        assert_eq!(sinc_lookup(20, 10, 10), DEFAULT_SINC);
        assert_eq!(sinc_lookup(10, 20, 10), DEFAULT_SINC);
        assert_eq!(sinc_lookup(10, 10, 20), DEFAULT_SINC);
    }

    #[test]
    fn test_lookup_valid() {
        // Valid lookups should return positive values (not sentinel)
        let val = sinc_lookup(1, 10, 10);
        assert!(
            val > 0.0,
            "Valid lookup should return positive value, got {}",
            val
        );
        assert!(
            val > DEFAULT_SINC,
            "Valid SInc should be > DEFAULT_SINC (0.07)"
        );
    }

    #[test]
    fn test_lookup_edge_cases() {
        // Test edge case indices (0 and 19 are valid, 20 is sentinel/out of bounds)
        assert!(sinc_lookup(0, 0, 0) > 0.0, "d=0, s=0, r=0 should be valid");
        assert!(
            sinc_lookup(19, 19, 19) > 0.0,
            "d=19, s=19, r=19 should be valid (last active)"
        );
        assert_eq!(
            sinc_lookup(20, 0, 0),
            DEFAULT_SINC,
            "d=20 should return DEFAULT_SINC"
        );
    }

    #[test]
    fn test_lookup_1_based_grade_conversion() {

        // Grade 1 (easiest) -> index 0 -> should give high SInc
        let grade_1_val = sinc_lookup(0, 10, 10);
        // Grade 20 (hardest) -> index 19 -> should give lower SInc
        let grade_20_val = sinc_lookup(19, 10, 10);

        assert!(
            grade_1_val > grade_20_val,
            "Easier difficulty (grade 1) should give higher SInc than hard (grade 20)"
        );
    }
}
