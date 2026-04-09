# Capability: SM18 Stats Display

## ADDED Requirements

### Requirement: SM18-specific metrics MUST be displayed in transparency UI

When SM18 is the active algorithm, the transparency panels MUST show SM18-specific metrics that are not available in FSRS.

#### Scenario: SM18 transparency panel shows reps and lapses
- Given a card with `algorithm_type = "sm18"` and parsed SM18 state
- When the transparency panel is displayed
- Then it shows the repetition count (`state.repetition`)
- And it shows the lapse count (`state.lapses`)

#### Scenario: SM18 inspector shows additional state fields
- Given a card with `algorithm_type = "sm18"`
- When the inspector panel is displayed
- Then it shows Reps (repetition count since last lapse)
- And it shows Lapses (total times forgotten)
- And it shows the difficulty scale label as "0-1" (not "1-10")

### Requirement: SM18 retrievability MUST be computed with correct formula

SM18 uses `R = 0.9^(t/S)` where S is defined as the number of days until R drops to 0.9. The existing `sm18Retrievability(stability, elapsedDays)` function MUST be used.

#### Scenario: SM18 retrievability displayed correctly
- Given a card with `algorithm_type = "sm18"`, stability = 10, elapsed = 10
- When retrievability is displayed
- Then it shows 90% (since `0.9^(10/10) = 0.9`)
