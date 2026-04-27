## Why

The YouTube IFrame Player API script (`http://www.youtube.com/iframe_api`) is being blocked by the Content Security Policy because `script-src` only allows `https://*.youtube.com` — it does not cover the HTTP variant. This prevents the `react-youtube` player from initializing, breaking inline YouTube playback entirely.

## What Changes

- Add `http://www.youtube.com` to the `script-src` directive in the production CSP (`tauri.conf.json`)
- Add `http://www.youtube.com` to the `script-src-elem` directive in the production CSP
- Verify the dev CSP already covers this scenario (it does via broad `https://` patterns, but add explicit `http://www.youtube.com` for consistency)

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `youtube-playback`: CSP must allow the YouTube IFrame API to load over HTTP in addition to HTTPS, so the inline player initializes without errors

## Impact

- `src-tauri/tauri.conf.json` — CSP policy strings in `app.security.csp` and `app.security.devCsp`
- No code changes required — this is purely a security policy configuration fix
