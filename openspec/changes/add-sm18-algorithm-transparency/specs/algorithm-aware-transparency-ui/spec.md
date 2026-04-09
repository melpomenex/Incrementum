# Capability: Algorithm-Aware Transparency UI

## ADDED Requirements

### Requirement: Transparency components MUST adapt to active algorithm

Review transparency UI components MUST detect the card's algorithm type and adapt their display, labels, and formulas accordingly.

#### Scenario: FSRS card reviewed — transparency panel shows FSRS-6 branding
- Given a card with `algorithm_type = "fsrs"`
- When the transparency panel is visible in the review view
- Then the panel title shows "FSRS-6 Transparency"
- And stability/difficulty are read from `card.memory_state`
- And difficulty is displayed on the FSRS 1-10 scale

#### Scenario: SM18 card reviewed — transparency panel shows SM18 branding
- Given a card with `algorithm_type = "sm18"`
- When the transparency panel is visible in the review view
- Then the panel title shows "SuperMemo 18 Transparency"
- And stability/difficulty/retrievability are read from `card.algorithm_state` via `parseSm18State()`
- And difficulty is displayed on the SM18 0-1 scale
- And additional SM18 stats (reps, lapses) are shown

#### Scenario: FSRS inspector forget curve uses correct formula for FSRS
- Given a card with `algorithm_type = "fsrs"`
- When the inspector panel calculates the forget curve
- Then it uses the FSRS formula `R = exp(-t/S)`

#### Scenario: SM18 inspector forget curve uses correct formula for SM18
- Given a card with `algorithm_type = "sm18"`
- When the inspector panel calculates the forget curve
- Then it uses the SM18 formula `R = 0.9^(t/S)`
- And the y-axis description reflects that S = days until R = 90% (not 37%)

#### Scenario: Item details popover shows correct algorithm label
- Given a learning item with `algorithm_type = "sm18"`
- When the item details popover is opened
- Then the scheduling section header shows "Scheduling / SuperMemo 18"
- And difficulty is displayed on the appropriate scale for the algorithm

#### Scenario: Zen review metadata sources data from correct state
- Given a card with `algorithm_type = "sm18"`
- When the zen review overlay is visible
- Then S, R, D, I values are read from the SM18 algorithm state
- And difficulty is displayed on the SM18 0-1 scale

### Requirement: Preview intervals MUST work for both algorithms

The simulated next intervals (Again/Hard/Good/Easy) MUST be computed using the correct algorithm.

#### Scenario: SM18 card shows SM18 preview intervals
- Given a card with `algorithm_type = "sm18"`
- When preview intervals are loaded
- Then they are computed by the SM18 scheduler (already implemented in backend)
- And displayed in the transparency panel and inspector
