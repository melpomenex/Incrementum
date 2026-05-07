## Spec: Router & Navigation Wiring

### Current State

`PodcastPage` exists at `src/pages/PodcastPage.tsx` but is NOT imported anywhere in:
- `src/App.tsx`
- `src/routes/` (any route file)
- The sidebar/tab bar

### Changes

1. **Import `PodcastPage`** in the appropriate route file (likely `src/routes/dashboard.tsx` or a new `src/routes/media.tsx`).
2. **Add podcast tab** to the sidebar with:
   - Icon: `Headphones` from lucide-react
   - Label: `t("tabs.podcast")` or `t("podcastManager.podcasts")`
   - i18n keys already exist in all locales
3. **Route definition**: Add a route for the podcast page in the dashboard router.
4. **Tab ordering**: Place between RSS and Settings (or between Continue Reading and Knowledge Graph, depending on UX preference).

### i18n

All `podcastManager.*` keys already exist in en, de, es, zh, fr, ja locales. No new translations needed for the initial wiring.
