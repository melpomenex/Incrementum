## MODIFIED Requirements

### Requirement: Exact-hit resolution degrades predictably
If an exact anchor can no longer be resolved because the underlying content changed after indexing, the system SHALL degrade in a predictable order instead of silently opening an unrelated location.

#### Scenario: Exact anchor fails after content drift
- **GIVEN** a stored exact anchor no longer resolves in the current document content
- **WHEN** the user activates the result
- **THEN** the viewer SHALL attempt to resolve the stored text quote or nearest equivalent match
- **AND** only fall back to a coarse page, section, or timestamp jump if no exact or near-exact match can be found

#### Scenario: All fallbacks exhausted
- **GIVEN** a stored exact anchor and text quote both fail to resolve
- **WHEN** the user activates the result
- **THEN** the viewer SHALL open the document at the coarse location (page, section, or timestamp)
- **AND** the search UI SHALL NOT show an active search state for the failed query
