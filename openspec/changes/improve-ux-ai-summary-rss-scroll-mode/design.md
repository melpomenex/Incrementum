## Context

The current AI Summary feature in RSS Scroll Mode uses a terminal-style aesthetic that was implemented as a quick prototype. The amber-on-black color scheme (`#1a1a1a` background with `#ffb000` text) creates visual inconsistency with the rest of the application which uses a modern, theme-aware design system based on CSS variables (`bg-background`, `text-foreground`, etc.).

Current implementation pain points:

- The terminal panel abruptly appears without smooth transitions
- No user control over summary length or focus areas
- Generated summaries are not cached, causing redundant API calls when users toggle the panel
- Limited actions - users can only view the summary, can't copy or save it
- Loading state is a simple pulse animation without progress indication
- Keyboard shortcut is the same as the "info" button (`i`), creating confusion

The application already has:

- A theme system with CSS variables for light/dark modes
- An `AssistantPanel` component with a modern design that could serve as reference
- `summarizeContent` API function for generating summaries
- Settings store for user preferences
- Framer Motion available in the project for animations

## Goals / Non-Goals

**Goals:**

- Create a modern, theme-aware summary panel that feels native to the application
- Implement smooth slide-in/slide-out animations (300ms ease-out for entry, 200ms ease-in for exit)
- Add summary generation controls for length (brief/medium/detailed) and focus areas
- Cache generated summaries per article in memory (with optional localStorage persistence)
- Add one-click actions: copy to clipboard, save as extract, share
- Improve loading states with stage-based progress indicators
- Implement dedicated keyboard shortcuts: `S` to generate/toggle, `H` to hide when open

**Non-Goals:**

- No changes to the underlying AI summarization API or backend
- No changes to the existing terminal mode (will remain as an option but not the default)
- No offline summary generation capability
- No summary history or versioning
- No collaborative/sharing features beyond basic copy/share

## Decisions

### 1. Use CSS transitions over Framer Motion for panel animations

**Rationale:** CSS transitions are lighter weight and sufficient for the simple slide animation. The panel only needs horizontal translation (from right/left edge) and opacity changes. This avoids adding Framer Motion dependencies to the scroll mode component and keeps bundle size minimal.
**Alternatives considered:** Framer Motion would provide more sophisticated animation control but adds unnecessary complexity for this use case.

### 2. Cache summaries in React state + localStorage with 7-day TTL

**Rationale:** Client-side caching prevents redundant API calls when users reopen the summary panel or revisit the same article. A 7-day TTL balances freshness with performance. localStorage provides persistence across sessions while React state provides fast in-memory access.
**Structure:** `summaryCache[articleId] = { content, timestamp, params: { length, focus } }`
**Alternatives considered:** IndexedDB would be overkill for simple text caching. Session-only caching would miss the primary use case of revisiting articles.

### 3. Inline badge approach for summary availability indicator

**Rationale:** Instead of showing the full panel, display a subtle "AI Summary Available" badge when a cached summary exists. Clicking expands to the full panel. This reduces visual clutter while making the feature discoverable.
**Implementation:** Small pill-shaped badge with sparkle icon, positioned near the article title. Auto-expands on first generation, then collapses to badge.

### 4. Keep terminal mode as toggle option, not default

**Rationale:** The retro terminal aesthetic has its fans and removing it entirely would be disruptive. Making it a toggle option (default: modern) allows power users to keep their preferred style while new users get the polished experience.
**Setting:** `rssSummary.mode: 'modern' | 'terminal'` in settings store

### 5. Use existing assistant infrastructure for summary generation controls

**Rationale:** The `AssistantPanel` already has a resizable panel implementation with position toggle (left/right). The summary panel should reuse this pattern for consistency. The controls (length, focus) can be added as a collapsible toolbar within the panel header.

### 6. Summary length mapping to token counts

**Rationale:** Map user-friendly labels to actual token limits for the AI:

- Brief: 100 tokens (~75 words)
- Medium: 200 tokens (current default, ~150 words)
- Detailed: 400 tokens (~300 words)
  This provides predictable output lengths while being user-friendly.

## Risks / Trade-offs

**[Risk] Caching may serve stale summaries if article content changes**
→ Mitigation: Store content hash with cache entry and invalidate if article content differs. Given RSS articles are typically immutable after publication, this is a low-risk edge case.

**[Risk] Larger summary panels may obscure article content on small screens**
→ Mitigation: On mobile (< 768px), panel slides up from bottom as a sheet (80vh height) instead of side panel. Collapses to minimal view when user scrolls article.

**[Risk] Additional controls add complexity to the UI**
→ Mitigation: Controls are collapsed by default, revealed by clicking a gear icon. The primary action (generate/regenerate) remains one-click from the main toolbar.

**[Risk] Copy to clipboard may fail in certain browser contexts**
→ Mitigation: Use the existing `navigator.clipboard.writeText` with fallback to `document.execCommand('copy')` for older browsers. Show toast notification on success/failure.

**[Trade-off] Modern panel requires more vertical space than terminal**
The modern panel has a header with controls and footer with actions, reducing the content area. This is acceptable as users can resize or collapse the panel.

## Migration Plan

**Deployment:**

1. Deploy new summary panel component behind feature flag (default: modern mode)
2. Allow users to toggle back to terminal mode via settings
3. After 2 weeks of feedback, remove feature flag and make modern mode the default
4. Terminal mode remains as an option indefinitely for users who prefer it

**Rollback:**

- Feature flag can be disabled to revert to terminal-only mode
- No database migrations required
- localStorage cache can be cleared via version key if format changes

## Open Questions

1. **Should we persist summary cache to the server?** This would enable cross-device summary sharing but adds complexity. Recommendation: Start with client-side only, evaluate need later.

2. **What focus areas should be available?** Proposal suggests "key points, actionable items, background context" - should these be mutually exclusive or multi-select? Recommendation: Single-select dropdown for simplicity in v1.

3. **Should summaries be automatically generated for all articles or on-demand only?** Auto-generation would be more convenient but increases API costs. Recommendation: On-demand only, with visual indicator when summary is cached.
