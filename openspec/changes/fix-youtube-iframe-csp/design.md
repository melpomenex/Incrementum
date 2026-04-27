## Context

The production CSP in `tauri.conf.json` allows `https://*.youtube.com` in `script-src` and `script-src-elem`. The YouTube IFrame Player API (loaded by `react-youtube`) requests `http://www.youtube.com/iframe_api` over plain HTTP, which is blocked by the CSP. This prevents the inline YouTube player from initializing.

The YouTube embed itself uses HTTPS (`https://www.youtube-nocookie.com/embed/...`), but the IFrame API script tag injected by `react-youtube` uses an `http://` URL for `www.youtube.com/iframe_api`.

## Goals / Non-Goals

**Goals:**
- Unblock the YouTube IFrame API script load so inline playback works
- Maintain a restrictive CSP — only add the minimal origin needed

**Non-Goals:**
- Changing how `react-youtube` loads the API (upstream library behavior)
- Refactoring the CSP into a more modular system
- Adding other YouTube-related origins beyond what's needed

## Decisions

**Add `http://www.youtube.com` to `script-src` and `script-src-elem` in both production and dev CSPs.**

- Alternative considered: Patch `react-youtube` to force HTTPS. Rejected — would require maintaining a fork or patch file for a minor URL difference, and YouTube's own embeds sometimes redirect to HTTP internally.
- Alternative considered: Use `http://*.youtube.com` wildcard. Rejected — overly broad. Only `www.youtube.com/iframe_api` is needed, so `http://www.youtube.com` is the minimum scope.

## Risks / Trade-offs

- [Allowing HTTP script origin] → Mitigated: only `www.youtube.com` is allowed (not wildcard), and the browser still validates the full origin. This is the same domain already trusted over HTTPS.
