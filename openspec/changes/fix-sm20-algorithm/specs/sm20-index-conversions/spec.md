## ADDED Requirements

### Requirement: Difficulty index quantization
The system SHALL convert raw difficulty D ∈ [0.0, 1.0] to a discrete index via `floor(D * 19) + 1`, clamped to [1, 10]. Difficulty values below 0.0 SHALL return index 10 (error sentinel). The index SHALL then be converted to a fraction via `index / 20.0`, yielding values in [0.05, 0.5]. This quantized fraction SHALL be used as the difficulty parameter in all interval formulas.

#### Scenario: Normal difficulty mapping
- **WHEN** difficulty D = 0.0
- **THEN** index = 1, fraction = 0.05

#### Scenario: Maximum difficulty mapping
- **WHEN** difficulty D = 1.0
- **THEN** index = 10, fraction = 0.5

#### Scenario: Mid-range difficulty quantizes to discrete level
- **WHEN** difficulty D = 0.5
- **THEN** index = floor(0.5 * 19) + 1 = 10, fraction = 0.5

#### Scenario: Negative difficulty returns error sentinel
- **WHEN** difficulty D = -0.5
- **THEN** index = 10, fraction = 0.5

#### Scenario: Difficulty just above zero maps to index 1
- **WHEN** difficulty D = 0.01
- **THEN** index = floor(0.01 * 19) + 1 = 1, fraction = 0.05

### Requirement: Stability pre-transform
The system SHALL apply a pre-transform to stability values before index conversion. The pre-transform SHALL: pass through values ≤ -1.0 unchanged; clamp values in (-1.0, 0.7) to 0.7; pass through values in [0.7, 44530.0]; and clamp NaN, Inf, and values > 44530 to 44530.0.

#### Scenario: NaN stability clamped to max
- **WHEN** stability S = NaN
- **THEN** pre-transformed value = 44530.0

#### Scenario: Infinite stability clamped to max
- **WHEN** stability S = +Infinity
- **THEN** pre-transformed value = 44530.0

#### Scenario: Low positive stability clamped to floor
- **WHEN** stability S = 0.3
- **THEN** pre-transformed value = 0.7

#### Scenario: Valid stability passes through
- **WHEN** stability S = 5.0
- **THEN** pre-transformed value = 5.0

#### Scenario: Error sentinel passes through
- **WHEN** stability S = -2.0
- **THEN** pre-transformed value = -2.0

### Requirement: Stability index quantization
The system SHALL convert pre-transformed stability S to a discrete index in [1, 20] via: subtract 2.0 (clamping negative to 0), raise to power (1/STABILITY_POWER ≈ 0.344), floor and add 1, then clamp to [1, 20]. The index SHALL then be converted back to a transformed value via `(index - 1)^STABILITY_POWER + 2.0`. This two-step process produces the discretized stability parameter used in interval formulas.

#### Scenario: Low stability maps to index 1
- **WHEN** stability S = 0.7 (pre-transformed = 0.7)
- **THEN** diff = 0.7 - 2.0 = -1.3 → clamped to 0, result = 0^0.344 = 0, index = 1, transformed = 0^2.904 + 2.0 = 2.0

#### Scenario: Stability of 3.0 produces valid index
- **WHEN** stability S = 3.0
- **THEN** diff = 1.0, pow(1.0, 0.344) = 1.0, index = 2, transformed = 1^2.904 + 2.0 = 3.0

#### Scenario: High stability maps to high index
- **WHEN** stability S = 100.0
- **THEN** diff = 98.0, index and transformed are computed per the formula (index > 2, transformed > 3.0)

#### Scenario: Stability index capped at 20
- **WHEN** stability S = 44530.0
- **THEN** index SHALL be 20, transformed SHALL be 19^2.904 + 2.0

### Requirement: Interval rounding
The system SHALL apply rounding to initial interval values. Wide mode (flags >= 4 or bit 1 set): clamp to [0.8, 20.0]. Narrow mode: clamp to [0.5, 2.0]. Values equal to the lower bound SHALL pass through (not be clamped).

#### Scenario: Wide mode clamps high values
- **WHEN** interval = 25.0 with flags = 4
- **THEN** result = 20.0

#### Scenario: Wide mode passes through lower-bound value
- **WHEN** interval = 0.8 with flags = 4
- **THEN** result = 0.8 (passes through because equal to lower bound)

#### Scenario: Narrow mode clamps to upper
- **WHEN** interval = 3.0 with flags = 0
- **THEN** result = 2.0
