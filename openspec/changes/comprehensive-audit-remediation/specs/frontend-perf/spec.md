## ADDED Requirements

### Requirement: Page components MUST use lazy loading
All page components in `App.tsx` SHALL be loaded via `React.lazy()` instead of static `import`. The `renderPage()` output SHALL be wrapped in a `Suspense` boundary with a loading indicator.

#### Scenario: Navigate to a page
- **WHEN** the user navigates to the Analytics page
- **THEN** only the Analytics page chunk SHALL be loaded (not all pages)

#### Scenario: Initial app load
- **WHEN** the app starts and displays the dashboard
- **THEN** only the shell code and dashboard page chunk SHALL be parsed and executed

### Requirement: Tauri build MUST NOT inline all dynamic imports
The `vite.config.ts` SHALL NOT use `inlineDynamicImports: true` for Tauri builds. Code splitting via `manualChunks` SHALL be enabled to produce separate vendor and page chunks.

#### Scenario: Tauri production build output
- **WHEN** `tauri build` is executed
- **THEN** the output SHALL contain multiple JS chunks, not a single 2MB+ file

### Requirement: QueueScrollPage MUST be decomposed into memoized sub-components
The 2535-line `QueueScrollPage.tsx` SHALL be broken into 5-8 focused sub-components: ScrollItemRenderer, OverlayControls, RatingPanel, RSSContentView, AssistantPanel integration, and QueueNavigation. Each sub-component SHALL be wrapped in `React.memo`.

#### Scenario: State change in one sub-component
- **WHEN** the RSS content view updates its scroll position
- **THEN** only the RSSContentView sub-component SHALL re-render, not the entire QueueScrollPage

#### Scenario: Rating submitted
- **WHEN** the user submits a rating
- **THEN** only the RatingPanel and affected queue items SHALL re-render

### Requirement: Frequently-rendered leaf components MUST use React.memo
The following components SHALL be wrapped in `React.memo`: ReviewCard, FlashcardScrollItem, StatusPill, PriorityGlyph, DocumentCard, StatCard.

#### Scenario: Parent re-render with same props
- **WHEN** a parent component re-renders but a memoized child's props have not changed
- **THEN** the child component SHALL NOT re-render

### Requirement: Zustand store subscriptions MUST use selectors
All multi-field store subscriptions SHALL use `useShallow` to prevent re-renders from unrelated state changes. Specifically: `routes/queue.tsx` (18 fields), `routes/review.tsx` (17 fields), `routes/documents.tsx` (13 fields), `routes/dashboard.tsx` (7 fields), `pages/QueueScrollPage.tsx`, `pages/AnalyticsPage.tsx`.

#### Scenario: Unrelated settings change during queue view
- **WHEN** the user changes a theme setting while viewing the queue
- **THEN** the queue view SHALL NOT re-render (settings not in its selector)

#### Scenario: Related state change
- **WHEN** the queue items change
- **THEN** components subscribed to `filteredItems` SHALL re-render

### Requirement: ReviewQueueView MUST use virtualization
The `ReviewQueueView` queue list SHALL use the existing `DynamicVirtualList` component (from `components/common/VirtualList.tsx`) instead of rendering all items as DOM nodes.

#### Scenario: Large queue
- **WHEN** the queue contains 200+ items
- **THEN** only visible items SHALL be in the DOM (approximately 10-20 nodes)

### Requirement: Font loading MUST be dynamic
Only the 3 user-selected fonts (sans-serif, serif, monospace) SHALL be loaded at startup based on the settings store. The static import of 68 `@fontsource` packages in `offline-fonts.css` SHALL be replaced with dynamic loading.

#### Scenario: Startup with default fonts
- **WHEN** the app starts and the user has Inter, Merriweather, and JetBrains Mono selected
- **THEN** only those 3 font CSS files SHALL be loaded, not all 68

#### Scenario: Font setting change
- **WHEN** the user changes their sans-serif font setting
- **THEN** the new font CSS SHALL be loaded and the old font CSS MAY be unloaded

### Requirement: HTML rendering MUST be memoized
The output of `renderAnkiHtmlWithLatex()` and `renderMarkdown()` SHALL be wrapped in `useMemo` keyed on the content string to prevent redundant HTML parsing on each render.

#### Scenario: Card re-render with same content
- **WHEN** a review card re-renders but the HTML content has not changed
- **THEN** `renderAnkiHtmlWithLatex` SHALL NOT re-execute the HTML parsing
