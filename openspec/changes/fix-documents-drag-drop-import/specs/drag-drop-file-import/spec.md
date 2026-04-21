## ADDED Requirements

### Requirement: Drag & drop file import SHALL route events through a single listener path per platform
The system SHALL register only platform-appropriate drag & drop event listeners. In Tauri mode, only Tauri native listeners (`tauri://drag-enter`, `tauri://drag-over`, `tauri://drag-leave`, `tauri://drop`) SHALL be active. In browser mode, only browser `window` listeners (`dragenter`, `dragover`, `dragleave`, `drop`) SHALL be active. No mode SHALL register both sets simultaneously.

#### Scenario: Files are dropped in Tauri mode
- **WHEN** user drags files onto the Documents Tab in Tauri mode
- **WHEN** user releases the files (drop)
- **THEN** only the `tauri://drop` handler SHALL process the event
- **THEN** the browser `window.drop` handler SHALL NOT fire or process files

#### Scenario: Files are dropped in browser mode
- **WHEN** user drags files onto the Documents Tab in browser mode
- **WHEN** user releases the files (drop)
- **THEN** only the browser `window.drop` handler SHALL process the event

### Requirement: Upload queue SHALL correctly report completed file paths to the parent component
After processing dropped files, the system SHALL notify the parent component with the file paths of all successfully imported documents. The notification SHALL use a locally tracked list of completed paths, NOT a React state read that may be stale due to batched updates.

#### Scenario: Single file dropped in browser mode
- **WHEN** user drops a single supported file in browser mode
- **THEN** the file SHALL be processed through the upload queue
- **THEN** the parent `onFilesImported` callback SHALL be invoked with the file's virtual path

#### Scenario: Multiple files dropped in browser mode
- **WHEN** user drops multiple supported files simultaneously in browser mode
- **THEN** each file SHALL be processed through the upload queue
- **THEN** the parent `onFilesImported` callback SHALL be invoked with all successful virtual paths

#### Scenario: Multiple files dropped in Tauri mode
- **WHEN** user drops multiple files simultaneously in Tauri mode
- **THEN** file paths SHALL be extracted from the Tauri drop event payload
- **THEN** the parent `onFilesImported` callback SHALL be invoked with all regular file paths

### Requirement: Drop event SHALL prevent default browser behavior
All drag and drop event handlers SHALL call `preventDefault()` and `stopPropagation()` to prevent the browser from navigating to or opening the dropped file.

#### Scenario: File dropped on any area of the Documents Tab
- **WHEN** user drops a file anywhere within the Documents Tab
- **THEN** the browser SHALL NOT navigate to or open the dropped file
- **THEN** the file SHALL be processed by the import system
