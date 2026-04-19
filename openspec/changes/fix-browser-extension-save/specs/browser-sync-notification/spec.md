## ADDED Requirements

### Requirement: Backend emits event on document creation via browser sync
The browser sync server SHALL emit a Tauri event (`browser-sync://document-saved`) after successfully creating a document from a browser extension page/link save. The payload MUST include `document_id`, `title`, and `url`.

#### Scenario: Page saved via extension context menu
- **WHEN** the browser extension sends a `save-page` or `save-link` request to the browser sync server and the document is created successfully
- **THEN** the server emits `browser-sync://document-saved` with `{ document_id: string, title: string, url: string }`

#### Scenario: Document already exists for URL
- **WHEN** the browser extension sends a request for a URL that already has a document in the database
- **THEN** the server emits `browser-sync://document-saved` with the existing document's `document_id`, `title`, and `url`

#### Scenario: Save request fails
- **WHEN** the browser extension sends a request that fails (e.g., database error)
- **THEN** no event is emitted and the server returns an error response to the extension

### Requirement: Backend emits event on extract creation via browser sync
The browser sync server SHALL emit a Tauri event (`browser-sync://extract-saved`) after successfully creating an extract from the browser extension. The payload MUST include `extract_id`, `document_id`, and `url`.

#### Scenario: Extract saved via extension
- **WHEN** the browser extension sends an extract save request and both the document and extract are created successfully
- **THEN** the server emits `browser-sync://extract-saved` with `{ extract_id: string, document_id: string, url: string }`

### Requirement: Frontend shows toast notification on browser sync save
The frontend SHALL listen for `browser-sync://document-saved` events and display a success toast notification to the user.

#### Scenario: User saves a page while app is open
- **WHEN** a `browser-sync://document-saved` event is received
- **THEN** a toast notification appears with the message "Page saved to Incrementum" and the document title, using the success toast type

#### Scenario: Toast rate limiting
- **WHEN** multiple `browser-sync://document-saved` events arrive in rapid succession (e.g., "save all tabs")
- **THEN** each save produces a toast, but the toast system caps visible toasts at its configured maximum (4)

### Requirement: Frontend refreshes document list on browser sync save
The frontend SHALL refresh the document store when a `browser-sync://document-saved` event is received, so the documents list reflects the newly saved document.

#### Scenario: Documents list updates after browser extension save
- **WHEN** a `browser-sync://document-saved` event is received
- **THEN** `loadDocuments()` is called on the document store within 1 second, making the new document visible in any open document list view

#### Scenario: Debounced reload for rapid saves
- **WHEN** multiple `browser-sync://document-saved` events arrive within 500ms
- **THEN** only a single `loadDocuments()` call is made after the last event in the burst

### Requirement: No unwrap panic on existing document lookup
The `handle_import_request` function SHALL NOT panic when an existing document is found for a URL. It MUST use safe pattern matching instead of `.unwrap()`.

#### Scenario: Existing document found for URL
- **WHEN** `find_document_by_url` returns `Ok(Some(doc))`
- **THEN** the function returns the existing document's ID without calling `unwrap()` on any `Option`
