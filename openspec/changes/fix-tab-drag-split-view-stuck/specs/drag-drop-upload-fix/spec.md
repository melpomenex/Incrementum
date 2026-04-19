## ADDED Requirements

### Requirement: DragDropUpload ignores tab-drag events
The `DragDropUpload` global drag event handlers SHALL NOT activate the file drop overlay or process files when the drag operation carries the MIME type `application/x-incrementum-tab`.

#### Scenario: User drags a tab to split-view on Documents tab
- **WHEN** a user initiates a tab drag (which sets `dataTransfer.types` to include `application/x-incrementum-tab`)
- **THEN** the `handleGlobalDragEnter` handler SHALL NOT set `isDragging` to true
- **AND** the file drop overlay SHALL NOT appear

#### Scenario: User drops a tab for split-view
- **WHEN** a user drops a tab that has `application/x-incrementum-tab` in its `dataTransfer.types`
- **THEN** the `handleGlobalDrop` handler SHALL NOT process the event as a file drop
- **AND** the split-view drop handler in `SplitPaneContainer` SHALL receive the event

#### Scenario: User drags actual files into the app
- **WHEN** a user drags files from the OS file manager (with `Files` type in `dataTransfer.types`)
- **THEN** the file drop overlay SHALL appear as before
- **AND** file import SHALL work normally
