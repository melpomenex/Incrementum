## 1. Flow Definition

- [ ] 1.1 Identify every queue-based extract creation path that currently disrupts reading flow (scroll mode document reader, imported web article editor, RSS/article reading, and optimal-session document flows).
- [ ] 1.2 Define a shared source-resume payload for queue-created extracts: queue mode, queue item ID, source ID, source type, and reader-location metadata.
- [ ] 1.3 Define validation and fallback rules for missing source items or stale location data.

## 2. Post-Create UX

- [ ] 2.1 Change queue extract creation so success keeps the user in the current reading surface by default.
- [ ] 2.2 Add a post-create success affordance with explicit actions for `Continue reading`, `View extract`, and `Resume queue` where applicable.
- [ ] 2.3 Ensure `View extract` focuses the created extract directly instead of dropping the user into a generic extracts list when the app can support direct targeting.

## 3. Extract Return Navigation

- [ ] 3.1 Add a persistent source-context bar to queue-created extract surfaces with source title and location hint.
- [ ] 3.2 Add source-aware actions such as `Back to book` / `Back to article` plus `Resume queue`.
- [ ] 3.3 Restore the exact reader location when supported, and fall back to source root or queue item root when exact restoration is unavailable.

## 4. Verification

- [ ] 4.1 Add tests covering queue extract creation without route disruption.
- [ ] 4.2 Add tests covering direct extract open followed by return-to-source for PDF/EPUB/article-style readers.
- [ ] 4.3 Add regression tests for deleted documents, stale queue sessions, and missing location metadata.
- [ ] 4.4 Run `openspec validate add-extract-source-return-navigation --strict`.
