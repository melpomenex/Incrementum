## Context

The Import/Export settings tab (`src/components/settings/ImportExportSettings.tsx`, ~1289 lines) contains 14 sections. Of these, 6 are labeled "Wave 3" or "Wave 4" and fall into three categories:

1. **Non-functional mocks** (localStorage-only, no real backend): Community marketplace, study groups, public profiles, plugin host
2. **Misleadingly labeled real features**: Logseq sync (actually Obsidian sync alias), Mnemosyne export (real), Daily Notes (real), Automation API (real)
3. **Misplaced UI settings**: Language selector, Zen mode toggle — these are interface preferences

The "Wave" terminology references a phased roadmap plan and has no meaning to users.

## Goals / Non-Goals

**Goals:**
- Remove all non-functional Wave 3/4 sections from Import/Export settings
- Relocate genuinely functional features that are currently buried in Wave sections to appropriate locations
- Strip "Wave" labels from remaining sections
- Reduce the component's line count significantly

**Non-Goals:**
- Building real backends for the community/plugin features (separate effort)
- Changing the Tauri/Rust backend
- Modifying the Obsidian/Logseq sync implementation itself
- Reorganizing other settings tabs

## Decisions

### 1. Delete mock sections entirely (don't hide behind feature flags)

**Decision**: Remove Community, Plugin Host, Study Groups, and Public Profile sections and their associated state/imports completely.

**Rationale**: These are localStorage stubs with no backend. Keeping them confuses users into thinking they work. Feature flags would add complexity for dead code. The underlying utility files (`wave4Social.ts`, `pluginHost.ts`) remain for potential future use.

**Alternative considered**: Collapsing into a "Coming Soon" section — rejected because it still clutters the UI and sets expectations.

### 2. Move Mnemosyne Export into the Export Legacy section

**Decision**: Add a "Mnemosyne (.txt)" button alongside existing JSON/CSV/Incrementum Package export options.

**Rationale**: Mnemosyne export is a real, functional feature. It belongs with other export format options rather than in a Wave-labeled section.

### 3. Move Automation API to a new "Integrations" sub-section or remove from this tab

**Decision**: Remove the Automation API section from Import/Export. If the API key management is needed elsewhere, it should live in a dedicated Integrations/API settings context.

**Rationale**: API key rotation is not an import/export concern. It's an advanced/integration feature.

### 4. Rename "Wave 3 Ingestion" to "Additional Imports"

**Decision**: Rename the section and integrate it visually with the main "Import Data" section.

**Rationale**: Podcast import, PDF highlight extraction, clipboard watcher, and Zotero/Mendeley import are all real, functional features. They should be presented without roadmap labels.

### 5. Remove UX & Language and Daily Notes from this tab

**Decision**: Remove these sections from Import/Export entirely. Language is already in General settings. Zen mode is already in Interface settings. Daily Notes has no natural home here.

**Rationale**: These features were grouped under Wave labels for development convenience, not user workflow.

## Risks / Trade-offs

- [Power users relying on Automation API from this tab] → They'll need to access it from a different location. The feature itself is unchanged.
- [Wave 3 Ingestion features less discoverable after rename] → Better section labeling and placement with other import options improves discoverability.
- [Users who bookmarked or documented the old layout] → Minor, one-time adjustment.
