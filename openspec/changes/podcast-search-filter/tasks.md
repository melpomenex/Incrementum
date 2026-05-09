## 1. Search Logic

- [x] 1.1 Create a `podcastFeedSearch` helper function that takes a query string and a `PodcastFeed[]` array, and returns filtered feeds matching against title, author, and description (case-insensitive substring). Strip HTML tags from descriptions before matching.
- [x] 1.2 Add unit tests for the search helper: matches on title, author, description; HTML stripping; empty query returns all feeds; no-match returns empty array.

## 2. UI — Search Input Enhancement

- [x] 2.1 Update the existing search input in `PodcastManager.tsx` sidebar header to use the new multi-field search function instead of title-only filtering.
- [x] 2.2 Add a clear button (X icon) to the search input that appears when text is present and clears the query on click.
- [x] 2.3 Add placeholder text to the search input (e.g., "Search podcasts...").

## 3. UI — Empty State

- [x] 3.1 Add an empty-state component/message in the feed list area that displays "No podcasts found" when the search query matches zero feeds.
- [x] 3.2 Ensure the empty state clears and feeds reappear when the query is modified to match results.

## 4. Feed Selection Handling

- [x] 4.1 When search filtering is active and the currently selected feed is filtered out, clear the selection and show the default episode panel empty state.
- [x] 4.2 When search filtering is active and the selected feed remains visible, preserve selection and continue showing its episodes.

## 5. Verification

- [ ] 5.1 Manual test: type queries matching feed titles, authors, and descriptions — verify correct filtering.
- [ ] 5.2 Manual test: clear search, verify all feeds return. Verify empty state shows for non-matching queries.
- [ ] 5.3 Manual test: verify context menus and right-click actions still work on filtered feed list.
