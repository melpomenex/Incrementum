## ADDED Requirements

### Requirement: Preserve LaTeX source during Anki import
The system SHALL preserve original LaTeX-bearing flashcard source content from APKG imports without destructive rewriting.

#### Scenario: Import preserves original math text
- **WHEN** an APKG card contains LaTeX delimiters or wrappers in front/back fields
- **THEN** the stored raw flashcard content MUST retain the original LaTeX text exactly

#### Scenario: Re-processing uses preserved source
- **WHEN** normalization rules are updated in a later release
- **THEN** the system MUST be able to re-run normalization from preserved source content without data loss

### Requirement: Normalize Anki LaTeX syntaxes into a render contract
The system SHALL detect and normalize supported Anki LaTeX syntaxes into a canonical representation consumed by review renderers.

#### Scenario: Normalize standard inline and display delimiters
- **WHEN** a flashcard contains `$...$`, `$$...$$`, `\(...\)`, or `\[...\]` math
- **THEN** the normalization output MUST emit canonical inline/display math tokens with preserved expression text

#### Scenario: Normalize Anki wrapper syntax
- **WHEN** a flashcard contains Anki-style math wrappers such as `[latex]...[/latex]`, `[$]...[/$]`, or `[$$]...[/$$]`
- **THEN** the normalization output MUST map them to canonical math tokens equivalent to supported inline/display rendering modes

### Requirement: Render normalized LaTeX across all flashcard review surfaces
The system SHALL render normalized LaTeX tokens consistently anywhere flashcard content is shown for study or preview.

#### Scenario: Review UI renders inline and display math
- **WHEN** normalized flashcard content is opened in any Incrementum review surface
- **THEN** all normalized math tokens MUST render into readable math output instead of raw delimiter text

#### Scenario: Surface consistency
- **WHEN** the same flashcard is viewed across desktop and mobile review surfaces
- **THEN** the rendered math output MUST follow the same normalization contract and produce semantically equivalent results

### Requirement: Fail gracefully for malformed or unsupported LaTeX
The system SHALL treat malformed or unsupported LaTeX as non-fatal and keep flashcards usable.

#### Scenario: Malformed expression fallback
- **WHEN** a card contains unbalanced delimiters or malformed TeX
- **THEN** review rendering MUST continue and display a deterministic fallback that includes the source expression text

#### Scenario: Unsupported command fallback
- **WHEN** a card contains a TeX command unsupported by the configured renderer
- **THEN** the system MUST avoid crashing, record a compatibility signal, and present readable fallback content

### Requirement: Protect compatibility with regression fixtures
The system SHALL include automated fixture-based coverage for representative Anki LaTeX inputs.

#### Scenario: Fixture suite covers real-world syntaxes
- **WHEN** CI runs for changes affecting import normalization or flashcard rendering
- **THEN** compatibility fixtures for supported Anki LaTeX syntaxes MUST pass for normalization and rendering expectations

#### Scenario: Regression detection
- **WHEN** an implementation change breaks expected normalization or render output for a known fixture
- **THEN** automated tests MUST fail before merge
