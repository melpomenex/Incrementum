# Podcast Subscription & Playback

## Status: Proposed

## Summary

Wire up the existing podcast UI shell to the Rust backend with SQLite persistence, server-side feed fetching, audio playback via the existing AudiobookViewer, queue integration, and Whisper transcription support.

## Key Decisions

- **Server-side feed fetching** — no more CORS proxy dependency; Rust/reqwest handles RSS parsing
- **Reuse AudiobookViewer** — podcast episodes stream through the same player that handles audiobooks
- **SQLite persistence** — migrate from localStorage to proper DB tables
- **Queue opt-in** — podcast episodes in the scroll queue controlled by user settings (like RSS)

## Open Questions

- Which RSS crate? `rss` (mature) vs manual parsing vs `opml` crate — the existing RSS codebase uses manual SQL queries, not a crate
- Should discovery use iTunes Search API or start with curated feeds?
- Mini-player bar scope — always visible or only during playback?
