## 1. Setup and Types

- [x] 1.1 Create types for summary cache entry (`SummaryCacheEntry`) in types directory
- [x] 1.2 Create types for summary generation parameters (`SummaryLength`, `SummaryFocus`)
- [x] 1.3 Add `rssSummary` settings type to settings store with mode, length, and focus preferences

## 2. Summary Caching Infrastructure

- [x] 2.1 Create `SummaryCache` class with methods: `get(articleId, contentHash)`, `set(articleId, entry)`, `clear()`, `loadFromStorage()`, `saveToStorage()`
- [x] 2.2 Implement content hash generation using simple string hash function
- [x] 2.3 Add 7-day TTL validation logic with automatic cleanup of expired entries
- [x] 2.4 Implement 100-entry LRU eviction when cache exceeds limit
- [x] 2.5 Add localStorage persistence with version key for cache format
- [x] 2.6 Create hook `useSummaryCache` for React integration

## 3. Modern Summary Panel Component

- [x] 3.1 Create `ModernSummaryPanel` component with theme-aware styling using CSS variables
- [x] 3.2 Implement slide-in/slide-out animations (300ms ease-out enter, 200ms ease-in exit)
- [x] 3.3 Add resizable panel with drag handle (240px min, 600px max)
- [x] 3.4 Implement position toggle (left/right) with persistence
- [x] 3.5 Create mobile responsive bottom sheet variant (< 768px)
- [x] 3.6 Add panel header with title, settings gear icon, and close button
- [x] 3.7 Create panel footer with action buttons (copy, save, share)
- [x] 3.8 Implement inline badge component for collapsed state

## 4. Summary Generation Controls

- [x] 4.1 Create `SummaryControls` component with collapsible design
- [x] 4.2 Add length selector dropdown (Brief: 100 tokens, Medium: 200 tokens, Detailed: 400 tokens)
- [x] 4.3 Add focus area selector dropdown (Key Points, Actionable Items, Background Context)
- [x] 4.4 Implement settings persistence to settings store and localStorage
- [x] 4.5 Add parameter change detection to invalidate mismatched cache entries
- [x] 4.6 Create regenerate button with loading state overlay on existing summary

## 5. Loading States and Progress

- [x] 5.1 Create `SummaryLoadingState` component with stage-based progress
- [x] 5.2 Implement stages: "Analyzing content...", "Extracting key points...", "Synthesizing summary..."
- [x] 5.3 Add progress bar or step indicator showing current generation stage
- [x] 5.4 Ensure terminal mode maintains existing loading behavior

## 6. Summary Actions Implementation

- [x] 6.1 Implement copy to clipboard with `navigator.clipboard.writeText` fallback to `execCommand`
- [x] 6.2 Add copy button with visual feedback (checkmark animation for 2 seconds)
- [x] 6.3 Create "Save as Extract" functionality using existing extract creation API
- [x] 6.4 Add tags ["ai-summary", "rss"] to saved extracts
- [x] 6.5 Implement share button with Web Share API detection
- [x] 6.6 Create share fallback for desktop (copy to clipboard with article URL)
- [ ] 6.7 Add "Export to Document" functionality with conflict detection

## 7. Integration with RSSScrollMode

- [x] 7.1 Replace existing summary panel with new `ModernSummaryPanel` component
- [x] 7.2 Add mode toggle between "modern" and "terminal" display modes
- [x] 7.3 Implement keyboard shortcuts: `S` to generate/toggle, `H` to hide
- [x] 7.4 Wire up summary cache to check for cached summaries on panel open
- [x] 7.5 Update `handleSummarize` to pass length and focus parameters to API
- [x] 7.6 Add inline badge rendering when summary exists but panel is closed
- [x] 7.7 Ensure existing terminal mode continues to work when selected

## 8. Settings Integration

- [x] 8.1 Add `rssSummary` section to settings store with defaults: mode="modern", length="medium", focus="key-points"
- [x] 8.2 Create settings migration to add new rssSummary settings
- [ ] 8.3 Add UI in settings panel for changing default summary mode, length, and focus
- [x] 8.4 Ensure settings persist across sessions via localStorage

## 9. Testing and Polish

- [ ] 9.1 Test panel animations on different screen sizes (desktop, tablet, mobile)
- [ ] 9.2 Verify cache persistence across browser sessions
- [ ] 9.3 Test keyboard shortcuts work correctly and don't conflict with existing shortcuts
- [ ] 9.4 Verify copy to clipboard works in both modern browsers and older contexts
- [ ] 9.5 Test mobile bottom sheet swipe-to-dismiss functionality
- [ ] 9.6 Verify theme switching (light/dark) applies correctly to panel
- [ ] 9.7 Test with very long summaries to ensure scrolling works correctly
- [ ] 9.8 Verify terminal mode still works as before

## 10. Documentation

- [ ] 10.1 Add JSDoc comments to new components and hooks
- [ ] 10.2 Update keyboard shortcuts documentation if applicable
- [ ] 10.3 Add inline comments for complex animation logic
- [ ] 10.4 Verify all new types are properly exported
