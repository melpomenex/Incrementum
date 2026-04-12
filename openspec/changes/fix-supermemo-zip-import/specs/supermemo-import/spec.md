## ADDED Requirements

### Requirement: Backend module is compiled and commands are registered
The `supermemo_import` module SHALL be declared in `src-tauri/src/lib.rs` and both `import_supermemo_package` and `validate_supermemo_package` SHALL be registered in `tauri::generate_handler![]`.

#### Scenario: Module compiles and commands are available
- **WHEN** the application builds
- **THEN** `src-tauri/src/supermemo_import.rs` compiles without errors and both Tauri commands are registered

#### Scenario: validate_supermemo_package is callable from frontend
- **WHEN** the frontend invokes `validate_supermemo_package` with a path to a .zip containing XML
- **THEN** the command returns `true`

#### Scenario: validate_supermemo_package rejects non-XML zips
- **WHEN** the frontend invokes `validate_supermemo_package` with a .zip that contains no XML files
- **THEN** the command returns an error

### Requirement: SuperMemo XML is parsed with a proper XML parser
The import module SHALL use `quick-xml` for XML parsing instead of string-based tag extraction. It SHALL handle CDATA sections, nested elements, and HTML content within XML elements.

#### Scenario: Q&A items are extracted from SuperMemo XML
- **WHEN** a .zip contains XML with `<Element>` blocks containing `<Question>` and `<Answer>` tags
- **THEN** the parser extracts question and answer text, preserving HTML content within those tags

#### Scenario: Topic items are extracted from SuperMemo XML
- **WHEN** a .zip contains XML with `<Topic>` blocks containing `<Title>` and `<Content>` tags
- **THEN** the parser extracts topic title and content

#### Scenario: CDATA content is preserved
- **WHEN** an XML element contains `<![CDATA[...]]>` wrapped content
- **THEN** the CDATA text content is extracted and preserved in the item content

#### Scenario: Unknown XML format falls back to generic handler
- **WHEN** a .zip contains XML that doesn't match known SuperMemo Q&A or Topic formats
- **THEN** the parser creates items from the text content via the generic fallback handler

### Requirement: Frontend wires SuperMemo import to the document store
The `handleImportFromPicker` function in `routes/documents.tsx` SHALL handle the `supermemo` source by calling the import utility, converting the collection to documents, and adding them to the document store.

#### Scenario: User imports a SuperMemo .zip via the import picker
- **WHEN** the user selects "SuperMemo" in the import picker, selects a .zip file, and the file contains valid SuperMemo XML
- **THEN** the system parses the .zip, converts items to documents, adds them to the store, closes the picker, and navigates to the first imported document

#### Scenario: Import error is shown to user
- **WHEN** the user selects a SuperMemo .zip and the import fails (invalid zip, no XML, parse error)
- **THEN** an error message is displayed to the user and the picker remains open

#### Scenario: Empty collection provides feedback
- **WHEN** the user imports a SuperMemo .zip that contains no items
- **THEN** an informational message is displayed indicating no items were found

### Requirement: Learning data is preserved as document metadata
Imported SuperMemo items SHALL carry their scheduling metadata (interval, repetitions, easiness) as document metadata fields, enabling future algorithm migration.

#### Scenario: Q&A item metadata is preserved
- **WHEN** a SuperMemo item has interval=30, repetitions=5, easiness=2.5
- **THEN** the imported document's metadata includes `superMemoId`, `interval`, `repetitions`, `easiness`, and `sourceCollection` fields
