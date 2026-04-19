## ADDED Requirements

### Requirement: FSRS parameter block
The system SHALL store the 35 FSRS-family parameters as a constant array matching `FSRS_PARAMS_FLAT` from the Python reference.

#### Scenario: Parameter count and first value
- **WHEN** the FSRS parameter array is initialized
- **THEN** it SHALL contain exactly 35 elements, with element [0] equal to 0.9286298950420208

### Requirement: Expert 1 — power-law forgetting
The system SHALL implement `fsrs_expert1(t, S)` computing `S * (S/(S+t))^pow(p[0]/0.9, 2)`, activating only when both `p[0] > 0` and `S > 0`.

#### Scenario: Expert 1 with typical inputs
- **WHEN** `t=10.0, S=5.0`
- **THEN** the result SHALL be positive and less than S

#### Scenario: Expert 1 with zero stability
- **WHEN** `S=0.0`
- **THEN** the result SHALL be 0.0 (activation check fails)

### Requirement: Expert 2 — shifted power-decay
The system SHALL implement `fsrs_expert2(t, S)` computing `pow(t/S + 1, 0.81)`, activating when `t > 0` and `t/S + 1 > 0`.

#### Scenario: Expert 2 grows with time
- **WHEN** `t=20.0, S=5.0`
- **THEN** the result SHALL exceed 1.0 (unbounded growth)

#### Scenario: Expert 2 inactive at zero time
- **WHEN** `t=0.0`
- **THEN** the result SHALL be 0.0 (activation check fails)

### Requirement: Expert 3 — exponential forgetting
The system SHALL implement `fsrs_expert3(t, S)` computing `2^(-|t/S| * 0.1053605)`, activating when `t > 0`.

#### Scenario: Expert 3 with equal time and stability
- **WHEN** `t=5.0, S=5.0`
- **THEN** the result SHALL equal `2^(-0.1053605)` (approximately 0.9296)

### Requirement: Expert mixture — retrievability proxy
The system SHALL implement `fsrs_expert_mixture(t, S)` computing a weighted average of all three experts with weights derived from FSRS parameters [1..4].

#### Scenario: Mixture at typical values
- **WHEN** `t=5.0, S=3.0`
- **THEN** the result SHALL be positive and finite

#### Scenario: Mixture at zero time
- **WHEN** `t=0.0`
- **THEN** the result SHALL be 0.0 (all experts inactive or weights zero)

### Requirement: FSRS difficulty update
The system SHALL implement `fsrs_difficulty_update(D, S, A, grade)` that updates difficulty based on review outcome, clamping the result to [0.0, 1.0].

#### Scenario: Successful grade increases difficulty target
- **WHEN** `D=0.5, S=5.0, A=0.8, grade=4`
- **THEN** the new difficulty SHALL be in [0.0, 1.0] and differ from the input D

#### Scenario: Lapse grade decreases difficulty
- **WHEN** `grade=1`
- **THEN** `d_target` SHALL be 0.0

### Requirement: FSRS lapse stability
The system SHALL implement `fsrs_lapse_stability(D, S, A)` for grade < 3, producing new stability via three multiplicative factors.

#### Scenario: Lapse reduces stability
- **WHEN** `D=0.5, S=10.0, A=0.6`
- **THEN** the result SHALL be less than the input S

### Requirement: FSRS recall stability
The system SHALL implement `fsrs_recall_stability(D, S, A, t, grade)` for grade >= 3, with hard bonus for early review, time decay, recall signal, and grade scaling.

#### Scenario: Recall grows stability
- **WHEN** `D=0.3, S=5.0, A=0.8, t=3.0, grade=4`
- **THEN** the result SHALL be greater than the input S

#### Scenario: Early review applies hard bonus
- **WHEN** `t < S` (early review)
- **THEN** the hard bonus component SHALL be applied using params[28], params[29], params[30]

#### Scenario: Late review skips hard bonus
- **WHEN** `t >= S` (late or on-time review)
- **THEN** the hard bonus SHALL equal params[28] only

### Requirement: FSRS review kernel
The system SHALL implement `fsrs_review_kernel(S, D, t, grade)` that dispatches to lapse or recall path based on grade, returning (new_S, new_D, interval, easiness).

#### Scenario: Lapse path
- **WHEN** `grade=1`
- **THEN** kernel SHALL call `fsrs_lapse_stability`, interval SHALL be `max(new_S, 1.0)`

#### Scenario: Recall path
- **WHEN** `grade=4`
- **THEN** kernel SHALL call `fsrs_recall_stability`, interval SHALL equal new_S if new_S > 1

#### Scenario: Easiness computation
- **WHEN** `S > 1.0`
- **THEN** easiness SHALL equal `new_S / S`

#### Scenario: Easiness with low stability
- **WHEN** `S <= 1.0`
- **THEN** easiness SHALL be 0.0

### Requirement: FSRS item initialization
The system SHALL implement `fsrs_init_item(grade, stability, flag)` returning a complete item state dictionary with fields: stability, difficulty, time, retrov, s_factor, multiplier, and auxiliary fields.

#### Scenario: Initialization with grade 3
- **WHEN** `grade=3, stability=1.0, flag=false`
- **THEN** difficulty SHALL be `params[8]`, s_factor SHALL be `params[14]`, multiplier SHALL be 3.0

#### Scenario: Initialization with flag true
- **WHEN** `flag=true`
- **THEN** multiplier SHALL be 0.5

### Requirement: Extended SM20State for FSRS branch
`SM20State` SHALL include an `algorithm_branch` field (defaulting to 0 for classic) and FSRS-family fields: `retrov`, `s_factor`, `multiplier`, with defaults that preserve backward compatibility.

#### Scenario: Parsing legacy state without new fields
- **WHEN** an existing `SM20State` JSON is deserialized that lacks `algorithm_branch`, `retrov`, `s_factor`, `multiplier`
- **THEN** `algorithm_branch` SHALL default to 0, `retrov` to the difficulty value, `s_factor` to 1.0, `multiplier` to 1.0

#### Scenario: Review dispatch selects correct branch
- **WHEN** `algorithm_branch == 0`
- **THEN** the review function SHALL use the classic V2/V4/V6 + Bayesian path
- **WHEN** `algorithm_branch == 1`
- **THEN** the review function SHALL use `fsrs_review_kernel`
