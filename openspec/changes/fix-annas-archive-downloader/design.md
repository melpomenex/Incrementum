## Context

The current Anna's Archive implementation is actually a Library Genesis (LibGen.li) client. While functional for a subset of books, it misses the vast majority of content indexed by Anna's Archive (Z-Library, Sci-Hub, Open Library, etc.). Users have reported that the "Anna's Archive" button in the app is misleading because it doesn't search the actual Anna's Archive database. Furthermore, the feature is disabled on non-macOS platforms due to unsolved networking/path bugs in the current Rust backend.

## Goals / Non-Goals

**Goals:**
- Implement a direct search for Anna's Archive using its web interface (`annas-archive.org/search`).
- Support multiple download mirrors (Anna's "Slow Download", LibGen.rs, LibGen.li, Z-Library).
- Extract richer metadata (MD5, cover URLs, ISBNs, descriptions).
- Resolve platform-specific issues to enable the feature on Windows and Linux.
- Maintain compatibility with the existing `BookSearchResult` and `DownloadProgress` interfaces.

**Non-Goals:**
- Implementing a full Playwright/browser-based automation (too heavy for Tauri backend).
- Bypassing member-only "Fast Download" restrictions.
- Implementing an account/login system for Anna's Archive.

## Decisions

### 1. Direct Mirror Scraping with Reqwest
**Decision**: Use `reqwest` with browser-like headers to scrape `annas-archive.org` and its mirrors.
**Rationale**: While Playwright (as used in `aget`) is more robust against Cloudflare, it is difficult to bundle in a cross-platform Tauri app. Most Anna's Archive mirrors currently allow basic scraping if headers (User-Agent, Accept, etc.) look like a legitimate browser.
**Alternatives**:
- *Playwright/Puppeteer*: Rejected due to bundle size and complexity.
- *Official API*: Anna's Archive has no stable public JSON API for free search at this time.

### 2. MD5-Centric Search and Download
**Decision**: Extract MD5 hashes from Anna's Archive search links and use them as the primary identifier for downloading.
**Rationale**: Anna's Archive aggregates multiple sources. The MD5 is the common denominator across LibGen, Z-Library, and Anna's own storage. By getting the MD5 from the search, we can attempt downloads from multiple mirrors (Direct, LibGen.li, LibGen.rs, etc.) using existing logic.

### 3. Multi-Mirror Fallback Strategy
**Decision**: Implement a tiered download strategy:
1. Attempt direct "Slow Download" from Anna's Archive.
2. If failed/blocked, parse the external mirror links (LibGen.li, LibGen.rs) from the Anna's Archive detail page.
3. Use the existing robust LibGen download logic as the final fallback.
**Rationale**: Direct downloads from Anna's Archive often involve wait timers or JS challenges. LibGen mirrors are often easier to scrape programmatically.

### 4. Expansion of `BookSearchResult` Metadata
**Decision**: Update the `BookSearchResult` struct to include `isbn`, `description`, and a list of `mirrors`.
**Rationale**: Anna's Archive provides much richer data than LibGen.li. This allows for better document matching and a better user experience during search.

## Risks / Trade-offs

- **[Risk] Cloudflare/Anti-bot Blocking** → **Mitigation**: Implement mirror rotation (annas-archive.org, .li, .se, .rs) and use randomized browser-like headers. If blocked, provide a clear error message to the user suggesting they check their connection or use a VPN.
- **[Risk] HTML Structure Fragility** → **Mitigation**: Use robust selectors (like `a.js-vim-focus` and `a.js-download-link`) that are part of the site's "keyboard navigation" or "stable" JS hooks, which are less likely to change than layout classes.
- **[Risk] Platform Incompatibility (Windows/Linux)** → **Mitigation**: Ensure all file paths in the Rust backend use `std::path` for cross-platform safety and verify networking permissions in Tauri's `tauri.conf.json`.
