## ADDED Requirements

### Requirement: V4 interval formula
The system SHALL implement the V4 interval formula (SM-20 proper) as: `result = (p3 * p5 + 1.0) * (p1 * p7 + p2) + p4`, where p1=difficulty_fraction, p2=stability_transformed, p3=0.8, p4=0.0, p5=0.9, p6=stability_transformed, p7=repetition (as float).

#### Scenario: V4 produces non-zero interval
- **WHEN** version=4, difficulty_fraction=0.25, stability_transformed=3.0, repetition=3
- **THEN** result = (0.8 * 0.9 + 1.0) * (0.25 * 3.0 + 3.0) + 0.0 = 1.72 * 3.75 = 6.45

#### Scenario: V4 with zero difficulty
- **WHEN** version=4, difficulty_fraction=0.05, stability_transformed=2.0, repetition=1
- **THEN** result = 1.72 * (0.05 * 1 + 2.0) + 0.0 = 1.72 * 2.05 = 3.526

### Requirement: V6 interval formula (FSRS-style)
The system SHALL implement the V6 interval formula (FSRS-style) as: `result = p4 + p1 * 2^(p6) * 2^(-p3 * p5)`, where p1=stability_transformed, p2=0.8, p3=stability_transformed, p4=repetition (as float), p5=difficulty_fraction, p6=0.9. The 2^x terms SHALL be clamped to [-38, 38] to prevent overflow.

#### Scenario: V6 produces non-zero interval
- **WHEN** version=6, stability_transformed=3.0, difficulty_fraction=0.25, repetition=3
- **THEN** result = 3 + 3.0 * 2^0.9 * 2^(-3.0*0.25) = 3 + 3.0 * 1.866 * 0.707 = 3 + 3.959 ≈ 6.959

#### Scenario: V6 exponent clamping prevents overflow
- **WHEN** the computed exponent exceeds 38.0
- **THEN** the 2^x term SHALL use 38.0 instead, producing 2^38

### Requirement: Version dispatch
The `compute_next_interval` function SHALL dispatch to V2, V4, or V6 based on the `version` parameter. Version 2 SHALL be the default when no version is specified. Invalid version values SHALL fall back to V2.

#### Scenario: Default version is V2
- **WHEN** compute_next_interval is called without specifying version
- **THEN** the V2 formula SHALL be used

#### Scenario: Version 4 dispatches correctly
- **WHEN** compute_next_interval is called with version=4
- **THEN** the V4 formula SHALL be used

#### Scenario: Version 6 dispatches correctly
- **WHEN** compute_next_interval is called with version=6
- **THEN** the V6 formula SHALL be used

#### Scenario: Invalid version falls back to V2
- **WHEN** compute_next_interval is called with version=99
- **THEN** the V2 formula SHALL be used

### Requirement: UFactor table
The system SHALL include the 20-element UFactor table indexed by difficulty D (0-19): [13.822076, 8.212571, 6.056511, 4.879609, 4.126662, 3.598557, 3.205138, 2.899285, 2.653822, 2.451912, 2.282528, 2.138131, 2.013379, 1.904376, 1.808207, 1.722649, 1.645970, 1.576804, 1.514055, 1.456836]. This table SHALL be available for interval calculations and Bayesian smoothing.

#### Scenario: UFactor lookup
- **WHEN** difficulty index = 0
- **THEN** UFactor[0] = 13.822076

#### Scenario: UFactor decreases monotonically
- **WHEN** iterating from index 0 to 19
- **THEN** each value SHALL be less than or equal to the previous value

### Requirement: Rust and TypeScript formula parity
For any identical inputs, the V2, V4, and V6 interval formulas in the Rust implementation SHALL produce the same results as the TypeScript implementation within f64 precision (tolerance < 1e-10).

#### Scenario: V2 parity
- **WHEN** the same rep_fraction, stability_transformed, and difficulty_fraction are passed to both implementations
- **THEN** the Rust and TypeScript V2 results SHALL differ by less than 1e-10

#### Scenario: V4 parity
- **WHEN** the same parameters are passed to both implementations
- **THEN** the Rust and TypeScript V4 results SHALL differ by less than 1e-10

#### Scenario: V6 parity
- **WHEN** the same parameters are passed to both implementations
- **THEN** the Rust and TypeScript V6 results SHALL differ by less than 1e-10
