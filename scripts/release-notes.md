### Added
- **Phosphor Icon System** — Migrated the entire icon library from `lucide-react` to `@phosphor-icons/react`, giving the design system access to six weight variants per icon (Thin, Light, Regular, Bold, Fill, Duotone) for richer active/selected and emphasis states. All ~260 icons across the app now render consistently at the `regular` weight.
- **Copy Story Link (RSS)** — Every RSS story now has a "Copy Link" button (in both the scroll feed and the focused reading view) that copies a clean article URL to the clipboard. Tracking parameters (`utm_*`, `fbclid`, `gclid`, `mc_cid`, YouTube `si`, and ~30 more) are automatically stripped, so the shared link is canonical and free of feed/marketing cruft. A toast confirms success.

### Fixed & Improved
- **Tab & Dashboard Icons** — Navigation tabs and dashboard quick-actions previously rendered inconsistent emoji glyphs (📚 🎴 📄 📊 ⚙️) depending on how the tab was opened. Tabs now derive their icon from their type via a single centralized Phosphor registry, so every navigation path — keyboard shortcuts, vimium commands, dashboard, mobile, session restore — shows a consistent, professional glyph.
- **Knowledge Graph RSS Label** — The RSS node-type label in the Knowledge Graph was leaking the raw i18n key `graph.rss`; the key is now defined in all six locales and resolves to "RSS".
- **macOS Shortcut Matching** — A keyboard-shortcut combo configured for the "primary modifier" (Cmd on macOS, Ctrl elsewhere) no longer incorrectly matches bare Ctrl on macOS.
- **Test Suite (42 fixes)** — Repaired the full test suite to green:
  - Restored a working `localStorage`/`sessionStorage` in the test environment (Node 25's native Web Storage global was shadowing jsdom's).
  - Fixed broken store mocks in `ReviewQueueView`, `LibraryDashboard`, and `DocumentsView` tests.
  - Aligned stale assertions with current component behavior (smart-sections, relative-time formatting, duplicate renders).
  - All 782 tests pass.
