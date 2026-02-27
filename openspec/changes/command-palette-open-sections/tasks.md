## 1. Model and Source Section Results

- [x] 1.1 Identify command palette result types and extend them to represent app section entries.
- [x] 1.2 Create a section destination registry (label, aliases, navigation target) for initial support, including Settings.
- [x] 1.3 Implement section query matching logic and deterministic scoring compatible with current document ranking behavior.

## 2. Integrate Mixed Results into Palette Search

- [x] 2.1 Merge matched section entries with existing document results into one unified result list.
- [x] 2.2 Ensure mixed results render correctly in the palette UI without breaking existing document display behavior.
- [x] 2.3 Verify highlight initialization and movement logic works consistently across mixed result types.

## 3. Handle Selection and Navigation Actions

- [x] 3.1 Update selection activation flow to dispatch by result type (`document` vs `section`) in one path.
- [x] 3.2 Wire section selection (Enter and pointer selection) to app navigation for the configured target area.
- [x] 3.3 Confirm document selection continues to use the existing document-open flow unchanged.

## 4. Validate Behavior with Tests

- [x] 4.1 Add tests for section matching by label and alias (for example, `settings` and alias queries).
- [x] 4.2 Add keyboard interaction tests for ArrowUp/ArrowDown traversal and Enter activation in mixed results.
- [x] 4.3 Add regression tests that assert document open behavior remains unchanged after section support is added.
