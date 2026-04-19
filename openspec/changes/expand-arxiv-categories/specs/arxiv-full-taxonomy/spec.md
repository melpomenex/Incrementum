## ADDED Requirements

### Requirement: Complete category taxonomy coverage
The system SHALL include all ArXiv categories from the official taxonomy (~155 categories) across all top-level domains: Computer Science (cs), Economics (econ), Electrical Engineering and Systems Science (eess), Mathematics (math), Astrophysics (astro-ph), Condensed Matter (cond-mat), General Relativity (gr-qc), High Energy Physics (hep-ex, hep-lat, hep-ph, hep-th), Mathematical Physics (math-ph), Nonlinear Sciences (nlin), Nuclear Physics (nucl-ex, nucl-th), Physics (physics), Quantum Physics (quant-ph), Quantitative Biology (q-bio), Quantitative Finance (q-fin), and Statistics (stat).

#### Scenario: User browses a physics category
- **WHEN** user expands the "Physics" domain group in the category sidebar
- **THEN** all physics subcategories (physics.acc-ph, physics.ao-ph, physics.app-ph, etc.) are displayed with their full display names

#### Scenario: User browses a quantitative finance category
- **WHEN** user expands the "Quantitative Finance" domain group
- **THEN** all q-fin subcategories (q-fin.CP, q-fin.EC, q-fin.GN, etc.) are displayed

#### Scenario: User browses a quantitative biology category
- **WHEN** user expands the "Quantitative Biology" domain group
- **THEN** all q-bio subcategories (q-bio.BM, q-bio.CB, q-bio.GN, etc.) are displayed

### Requirement: Domain-grouped category sidebar
The category sidebar in the ArXiv import dialog SHALL display categories organized into collapsible groups by top-level domain. Each group header SHALL show the domain name. Groups SHALL be collapsible/expandable by clicking the header.

#### Scenario: Default sidebar state
- **WHEN** the ArXiv import dialog opens
- **THEN** the Computer Science group is expanded and all other groups are collapsed
- **AND** the first category in Computer Science (cs.AI) is pre-selected and its papers are loaded

#### Scenario: User expands a domain group
- **WHEN** user clicks on a collapsed domain group header (e.g., "Physics")
- **THEN** that group expands to show all its subcategories
- **AND** other groups remain in their current state

#### Scenario: User collapses a domain group
- **WHEN** user clicks on an expanded domain group header
- **THEN** that group collapses to show only the header

### Requirement: Complete category display name lookup
The `getCategoryDisplayName` function SHALL return human-readable names for all ~155 ArXiv categories, not just the current 11. For categories with aliases (e.g., cs.NA is an alias for math.NA), the function SHALL return the primary domain's name.

#### Scenario: Display name for a condensed matter category
- **WHEN** `getCategoryDisplayName("cond-mat.str-el")` is called
- **THEN** it returns "Strongly Correlated Electrons"

#### Scenario: Display name for a physics category
- **WHEN** `getCategoryDisplayName("physics.optics")` is called
- **THEN** it returns "Optics"

#### Scenario: Display name for an alias category
- **WHEN** `getCategoryDisplayName("cs.NA")` is called
- **THEN** it returns "Numerical Analysis" (matching math.NA)

### Requirement: Single source of truth for category data
All category data (IDs, display names, domain groupings) SHALL be defined in a single constant (`ARXIV_DOMAINS`). The `POPULAR_CATEGORIES` export and `getCategoryDisplayName` function SHALL derive their data from this constant. No duplicate category definitions SHALL exist.

#### Scenario: Adding a new category
- **WHEN** a new ArXiv category is added to the `ARXIV_DOMAINS` constant
- **THEN** it automatically appears in the sidebar, is browsable, and has a correct display name without any other code changes
