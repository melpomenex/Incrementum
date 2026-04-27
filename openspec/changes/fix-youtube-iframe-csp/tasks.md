## 1. Update Production CSP

- [x] 1.1 Add `http://www.youtube.com` to `script-src` in the production `csp` field in `src-tauri/tauri.conf.json`
- [x] 1.2 Add `http://www.youtube.com` to `script-src-elem` in the production `csp` field in `src-tauri/tauri.conf.json`

## 2. Update Development CSP

- [x] 2.1 Add `http://www.youtube.com` to `script-src` in the `devCsp` field in `src-tauri/tauri.conf.json`
- [x] 2.2 Add `http://www.youtube.com` to `script-src-elem` in the `devCsp` field in `src-tauri/tauri.conf.json`

## 3. Verification

- [ ] 3.1 Build the Tauri app and open a YouTube document to confirm the IFrame API loads without CSP violations
- [ ] 3.2 Verify no new CSP violation errors appear in the console
