## ADDED Requirements

### Requirement: PDF data buffer SHALL be independently copyable
The system SHALL ensure that the `Uint8Array` passed to `pdfjsLib.getDocument()` is backed by a fully independent `ArrayBuffer` that has not been detached or transferred, preventing `structuredClone` failures in WebView2 on Windows.

#### Scenario: PDF loads successfully on Windows 11
- **WHEN** a user opens a PDF document on Windows 11 (WebView2)
- **THEN** the PDF SHALL render without a `structuredClone` or `ArrayBuffer detached` error

#### Scenario: PDF loads successfully on other platforms
- **WHEN** a user opens a PDF document on Linux (WebKitGTK) or macOS
- **THEN** the PDF SHALL render as before with no regressions
