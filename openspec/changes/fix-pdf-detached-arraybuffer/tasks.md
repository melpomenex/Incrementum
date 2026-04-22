## 1. DocumentViewer — defensive copy at base64 decode

- [x] 1.1 In `DocumentViewer.tsx` (~line 1032-1038), replace the manual byte copy loop with `new Uint8Array(bytes)` after the `atob()` decode to ensure the `Uint8Array` has its own independent `ArrayBuffer`

## 2. PDFViewer — independent buffer for pdfjsLib

- [x] 2.1 In `PDFViewer.tsx` (~line 527-531), replace `fileData.slice()` with `new Uint8Array(fileData)` in the data source construction to guarantee a fresh backing `ArrayBuffer` for every `pdfjsLib.getDocument()` call

## 3. Verification

- [x] 3.1 Build the app and verify no TypeScript errors
- [ ] 3.2 Test PDF loading on Windows 11 (if available) to confirm the `structuredClone` error is resolved
