## Why

The AI Summary feature in RSS Scroll Mode currently has suboptimal UX that creates friction during the reading flow. The terminal-style summary panel uses a jarring amber-on-black color scheme that doesn't match the application's design system, lacks smooth transitions when opening/closing, and provides limited control over summary generation parameters. Users need a more polished, integrated experience that feels native to the scroll mode interface while providing better control over AI-generated content.

## What Changes

- **Redesigned Summary Panel**: Replace the retro terminal aesthetic with a modern, theme-aware panel that matches the application's design system (using CSS variables for light/dark mode support)
- **Smooth Transitions**: Add slide-in/slide-out animations with proper easing when opening or closing the summary panel
- **Summary Controls**: Add UI controls for adjusting summary length (brief/medium/detailed) and focus areas (key points, actionable items, background context)
- **Inline Summary Preview**: Show a condensed inline summary badge that expands to the full panel on interaction, reducing visual clutter
- **Summary Persistence**: Cache generated summaries per article with a refresh option to avoid regenerating identical content
- **Improved Loading States**: Replace the basic pulse animation with a progress indicator showing generation stages (analyzing, extracting key points, synthesizing)
- **One-Click Actions**: Add quick action buttons to copy summary, save as extract, or share directly from the summary panel
- **Keyboard Shortcuts**: Add dedicated shortcuts for summary generation (`S` key) and toggling summary visibility (`H` to hide/show)

## Capabilities

### New Capabilities

- `rss-summary-panel`: Modern, theme-aware summary panel with smooth animations and responsive design
- `summary-generation-controls`: UI for configuring summary length, focus areas, and regeneration options
- `summary-caching`: Client-side caching of generated summaries with metadata (timestamp, model used, parameters)
- `summary-actions`: One-click actions for copying, saving as extract, and sharing summaries

### Modified Capabilities

- None - this is a UI/UX enhancement that doesn't change the underlying AI summarization API or requirements

## Impact

- **UI Components**: `RSSScrollMode.tsx`, `QueueScrollPage.tsx`
- **Stores**: May need to extend settings store for summary preferences persistence
- **API**: No API changes required - uses existing `summarizeContent` function
- **Dependencies**: No new dependencies - uses existing Tailwind CSS and Framer Motion (if available) or CSS transitions
- **Browser/Extension**: Changes apply to both desktop app and browser extension contexts
- **Accessibility**: Improved keyboard navigation and focus management for the summary panel
