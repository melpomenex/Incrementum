## Context

`DocumentViewer` is used both standalone (in Document view mode) and embedded within `QueueScrollPage` (Scroll Mode / Optimal Session). In both contexts, `DocumentViewer` renders its own orb rating buttons (lines 4911-4991). Meanwhile, `QueueScrollPage` also renders its own side rating controls (lines 2334-2455) for documents and RSS items. This results in two overlapping sets of rating orbs when viewing a document in Scroll Mode.

## Goals / Non-Goals

**Goals:**
- Eliminate duplicate rating orbs in Scroll Mode by hiding `DocumentViewer`'s orbs when it's rendered inside `QueueScrollPage`
- Keep `DocumentViewer`'s orbs intact when used standalone

**Non-Goals:**
- Changing the rating logic, API calls, or FSRS scheduling
- Modifying the side rating controls in `QueueScrollPage`
- Changing rating UI for flashcards or extracts

## Decisions

### Pass an `hideRatingOrbs` prop to DocumentViewer

`QueueScrollPage` already passes props to `DocumentViewer` when rendering it. Add a boolean prop (e.g. `hideRatingOrbs`) that `QueueScrollPage` sets to `true`. `DocumentViewer` gates its orb section behind `!hideRatingOrbs`.

**Why this approach:** Minimal change — one prop, one conditional. `DocumentViewer` remains self-contained and works unchanged in its standalone context where the prop defaults to `false`.

**Alternative considered:** Conditionally render based on a React context or route check. Rejected because a prop is simpler and more explicit.

## Risks / Trade-offs

- **Prop drilling** → Single prop, single consumer. Acceptable complexity.
- **Missing standalone coverage** → Default `hideRatingOrbs` to `false`/`undefined` so standalone usage is unaffected without changes.
