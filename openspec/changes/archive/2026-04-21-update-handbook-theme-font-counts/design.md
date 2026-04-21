## Context

The USER_HANDBOOK.md currently has outdated/incomplete information about visual customization:
- Theme count says "17 built-in themes" — actual count is 147 (26 modern + 121 legacy)
- Font family selection feature (65 fonts) is not documented at all

## Goals / Non-Goals

**Goals:**
- Correct the theme count in both the Initial Setup and Settings > Appearance sections
- Add documentation for the font family selection feature with accurate font count and category breakdown

**Non-Goals:**
- Changing any code — this is documentation only
- Documenting animated backdrop settings or other undocumented features outside the user's request
- Restructuring the handbook layout

## Decisions

**Keep the existing structure** — update theme counts in-place where they currently appear (lines ~57 and ~581) and add a font family subsection in the existing Settings > Appearance > Display Options area (around line 607), since that's where font-related settings are already grouped.

**Report total (147) with category breakdown** rather than listing every theme by name. Naming all 147 would bloat the handbook; a count with the modern/legacy distinction gives users context without overwhelming them.

**Document fonts by category count** (sans-serif: 25, serif: 5, monospace: 31, display: 2, system: 4) rather than listing all 65 names. This keeps the handbook concise while showing the breadth of options.

## Risks / Trade-offs

- [Theme count may drift] → If themes are added/removed, the handbook will need updating again. Mitigate by noting "as of v1.x.x" or similar.
- [Font list is hardcoded in SettingsPage.tsx] → If fonts change, the handbook count becomes stale. Same mitigation.
