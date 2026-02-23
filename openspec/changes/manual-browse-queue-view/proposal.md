## Why

Users currently lack a clear, manual way to browse items in their Queue from the Queue View tab. This change is needed now to align queue interaction with the app's UX/UI standards and reduce friction when selecting or reviewing queued items.

## What Changes

- Add a manual browse interaction model in Queue View so users can explicitly navigate queue items.
- Define visible browse controls and states (default, focused/selected, empty, and loading) consistent with existing app UX/UI patterns.
- Define expected behavior for moving through queue items, preserving context, and opening/activating the selected item.
- Ensure the manual browse experience works for both pointer and keyboard-driven interaction.

## Capabilities

### New Capabilities
- `queue-manual-browse`: Manual browsing behavior, controls, and state handling for user queue navigation in Queue View.

### Modified Capabilities
- None.

## Impact

- Affected code: Queue View tab UI components, queue state management, and input/interaction handlers.
- APIs/systems: Existing queue data retrieval and playback activation paths may be reused but not fundamentally changed.
- Dependencies: No new external dependencies expected; may require minor shared UI component updates for consistency.
