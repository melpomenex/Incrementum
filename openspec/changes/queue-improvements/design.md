## Context

Inside the queue scroll page (`QueueScrollPage.tsx`), users review different items, including videos (YouTube), audios (podcasts), and text (documents). Currently, there is no option to automatically transition to the next item when a video or audio ends. Also, text selection context menus inside `DocumentViewer.tsx` are broken in queue scroll view because any mousedown click outside the document content (including on the context menu itself) unmounts the menu before the click action can propagate.

## Goals / Non-Goals

**Goals:**
- Add an `autoProceed` setting in `ScrollQueueSettings` to automatically advance items in the queue when media ends.
- Propagate `onEnded` callback from media players (`YouTubeViewer`, `LocalVideoPlayer`) through `DocumentViewer` to `QueueScrollPage`.
- Fix the text-selection context menu and submenus to not close prematurely when clicked by ignoring mousedown events on `.context-menu` elements.

**Non-Goals:**
- Auto-proceed for text-only documents or RSS articles (which have no definite playback length).
- Modification to other pages or global context menus outside document viewers.

## Decisions

### Decision 1: Store `autoProceed` in settings store
- **Alternative:** Store `autoProceed` in local storage directly in `QueueScrollPage`.
- **Rationale:** Storing it in `settingsStore` keeps settings synchronized and consistent, reusing the existing settings infrastructure.

### Decision 2: Listen for `.context-menu` in `handleClickOutside` of `DocumentViewer`
- **Alternative:** Stop propagation on context menu clicks.
- **Rationale:** Adding `target.closest('.context-menu')` to `handleClickOutside` is cleaner and doesn't interfere with other mousedown behaviors or other components.

## Risks / Trade-offs

- **[Risk]** Auto-proceeding too quickly could cause users to miss the ended video's final screen or archive prompt.
  - **Mitigation:** Auto-proceed only happens when video/audio actually ends. Users can turn off this option if they prefer manual control.
