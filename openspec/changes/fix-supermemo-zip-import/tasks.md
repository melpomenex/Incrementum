## 1. Backend Module Activation

- [x] 1.1 Rename `src-tauri/src/supermemo.rs` to `src-tauri/src/supermemo_import.rs`
- [x] 1.2 Add `mod supermemo_import;` to `src-tauri/src/lib.rs`
- [x] 1.3 Add `import_supermemo_package` and `validate_supermemo_package` to `tauri::generate_handler![]` in `lib.rs`
- [x] 1.4 Verify the project compiles with `cargo check`

## 2. XML Parser Upgrade

- [x] 2.1 Add `quick-xml` dependency to `Cargo.toml`
- [x] 2.2 Rewrite `parse_supermemo_qa_xml` to use `quick-xml::Reader` event-based parsing
- [x] 2.3 Rewrite `parse_supermemo_topic_xml` to use `quick-xml::Reader`
- [x] 2.4 Update `parse_generic_supermemo_xml` to strip tags via `quick-xml` instead of regex
- [x] 2.5 Remove the manual `extract_xml_tag` helper function
- [x] 2.6 Verify compilation and run any existing tests

## 3. Frontend Import Wiring

- [x] 3.1 Add `supermemo` case to `handleImportFromPicker` in `src/routes/documents.tsx` that calls `importSuperMemoPackage` and `convertSuperMemoCollectionToDocuments`
- [x] 3.2 Add imported documents to the document store via `importFromFiles` or equivalent store method
- [x] 3.3 Add error handling — display toast/message on import failure and show feedback for empty collections
- [x] 3.4 Close the picker and navigate to the first imported document on success
