## ADDED Requirements

### Requirement: Bayesian prior interval formula
The system SHALL implement a Bayesian prior interval formula (`interval_initial`) with its own constant set (INIT dict): stability_scale_max=15.0, stability_scale_min=3.0, anchor=1.0, rep_power_offset=-0.08, rep_power_coeff=-0.35, base_sub=1.0, base_add=1.0, penalty_slope=-2.0, penalty_intercept=2.25, penalty_clamp=600.0. The formula structure SHALL match V2 but with these constants. The result SHALL be rounded in wide mode and clamped to a minimum of 1.0.

#### Scenario: Prior produces interval for first repetition
- **WHEN** computing initial interval with rep_fraction=0.0, stability_transformed=3.0, difficulty_fraction=0.25
- **THEN** the system SHALL apply the INIT constants and return a value >= 1.0

#### Scenario: Prior result is rounded in wide mode
- **WHEN** the raw prior result exceeds 20.0
- **THEN** the result SHALL be clamped to 20.0

#### Scenario: Prior result is floored at 1.0
- **WHEN** the raw prior result is below 1.0
- **THEN** the result SHALL be clamped to 1.0

### Requirement: 21³ interval and count matrices
The system SHALL maintain two 21×21×21 flat arrays (9261 elements each): an interval matrix (f64) and a count matrix (u32/i32). Both SHALL be initialized to zero. Index 20 in each dimension is a sentinel (always zero). Active range is indices 0..19. The flat index SHALL be computed as `R * 441 + S * 21 + D`.

#### Scenario: Matrix initialized to zero
- **WHEN** a new SM-20 instance is created
- **THEN** all 9261 elements in both matrices SHALL be zero

#### Scenario: Flat index computation
- **WHEN** R=5, S=10, D=3
- **THEN** flat index = 5*441 + 10*21 + 3 = 2205 + 210 + 3 = 2418

### Requirement: Bayesian 3×3×3 neighbor smoothing
The system SHALL implement the `bayesian_smooth` function that computes a smoothed stability increase factor for a given matrix cell (r_idx, s_idx, d_idx). The algorithm SHALL: (1) compute a prior via `interval_initial`, (2) read the target cell's interval and count, (3) accumulate a 3×3×3 neighbor cube (skipping cells where any index == 0), (4) blend using sigmoid-weighted averaging with constants: prior_weight=500.0, target_weight_scale=10.0, neighbor_weight_denom=1000.0, cube_weight=3.0, neutral=1.0. The blended formula SHALL be: `(prior + target_interval * tw + avg * nw * cube_weight) / (tw + neutral + nw * cube_weight)` where `tw = sigmoid(target_count, 500) * 10` and `nw = sigmoid(neighbor_count_sum, 1000)`.

#### Scenario: Empty matrices return prior only
- **WHEN** bayesian_smooth is called with zero-initialized matrices
- **THEN** result SHALL equal the prior value (no smoothing applied)

#### Scenario: Target cell with data blends with prior
- **WHEN** target cell has count=100 and a non-zero interval
- **THEN** result SHALL be a weighted blend of prior and target interval

#### Scenario: Neighbors contribute to smoothing
- **WHEN** adjacent cells have positive counts and intervals
- **THEN** result SHALL incorporate neighbor-weighted averages

#### Scenario: Boundary cells skip zero-index neighbors
- **WHEN** r_idx=0, any neighbor with nr=0 SHALL be excluded from the accumulation
- **THEN** the neighbor cube effectively shrinks for boundary cells

### Requirement: Review recording updates matrices
The system SHALL provide a `record_review` function that updates the interval and count matrices after each review. The target cell SHALL be identified by the item's quantized difficulty index, stability index, and repetition index. The count SHALL be incremented by 1, and the interval SHALL be updated via incremental average: `new_interval = (old_interval * old_count + interval_used) / (old_count + 1)`.

#### Scenario: First review initializes cell
- **WHEN** record_review is called on a cell with count=0 and interval=0.0, with interval_used=3.0
- **THEN** count becomes 1, interval becomes 3.0

#### Scenario: Subsequent reviews update running average
- **WHEN** record_review is called on a cell with count=1 and interval=3.0, with interval_used=5.0
- **THEN** count becomes 2, interval becomes (3.0*1 + 5.0)/2 = 4.0

### Requirement: Smoothing activates only when data exists
The main `compute_next_interval` function SHALL apply Bayesian smoothing ONLY when both matrices are provided AND the target cell's count > 0. When matrices are absent or the target cell is empty, the raw formula result SHALL be used unchanged.

#### Scenario: No matrices provided
- **WHEN** interval_matrix and count_matrix are None/null
- **THEN** the system SHALL use the raw formula result without smoothing

#### Scenario: Target cell empty
- **WHEN** matrices are provided but the target cell has count=0
- **THEN** the system SHALL use the raw formula result without smoothing
