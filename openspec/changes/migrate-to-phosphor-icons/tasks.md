# Tasks: Migrate icon library from lucide-react to @phosphor-icons/react

## 1. Install & map
- [x] 1.1 `npm install @phosphor-icons/react` (v2.1.10)
- [x] 1.2 Build `scripts/icon-map.json` — 152 renames, 108 same-name (261 distinct lucide identifiers total)
- [x] 1.3 Verify every mapped Phosphor name actually exports from `@phosphor-icons/react` (validated against the authoritative `dist/index.d.ts` export list: 1512 valid names, 0 unresolved)

## 2. Codemod
- [x] 2.1 Write `scripts/migrate-icons.mjs` (regex import-rewrite + whole-word identifier rename + `type LucideIcon`/value-`LucideIcon` → `type Icon`; idempotent; `--dry-run` flag)
- [x] 2.2 Clean git working tree checkpoint established (changes reversible via single `git checkout`)
- [x] 2.3 Run codemod across `src/` — **268 files migrated**, report at `scripts/migrate-report.txt`
- [x] 2.4 Codemod idempotent (re-run finds no `lucide-react` imports → no-op)

## 3. Manual fixes
- [x] 3.1 `StatCard.tsx` — `LucideIcon` (value import) → `type Icon`
- [x] 3.2 `TabIcons.tsx` — `type LucideIcon` → `type Icon` (codemod had used `IconType`, which Phosphor does not export; corrected to `Icon`)
- [x] 3.3 Config-object typing (`ImportProgressIndicator.tsx`, `TranscriptionButton.tsx`, `FileSyncStatusIndicator.tsx`) — codemod already produced correct `typeof CircleNotch` / `icon: CircleNotch`; no manual change needed
- [x] 3.4 Ambiguous icons resolved via the validated map (`Maximize2`→`ArrowsOutSimple`, `Minimize2`→`ArrowsInSimple`, `BarChart`→`ChartBarHorizontal` vs `BarChart3`→`ChartBar` kept distinct)
- [x] 3.5 No missing-export errors — tsc passes cleanly
- [x] 3.6 `vite.config.ts` manual-chunks config repointed `node_modules/lucide-react` → `node_modules/@phosphor-icons` (same `ui-vendor` chunk)
- [x] 3.7 Stale comments updated in `KeyboardShortcutsPanel.tsx` and `ShortcutTooltip.tsx` (custom SVG key glyphs retained — Phosphor has no Escape/Shift/Ctrl/Alt key icons)

## 4. Remove lucide-react
- [x] 4.1 `grep -r "lucide-react" src/` returns zero hits (only stale comments remain, now updated)
- [x] 4.2 `npm uninstall lucide-react`
- [x] 4.3 `package.json` / `package-lock.json` no longer reference it

## 5. Verify
- [x] 5.1 `npx tsc --noEmit` — **0 errors**
- [x] 5.2 `npx eslint src/` — **0 errors** (159 pre-existing warnings, unrelated to migration)
- [x] 5.3 `npm run test:run` — 732 passed / 42 failed / 1 skipped. **The 42 failures are pre-existing** (confirmed by re-running the same test files against the clean lucide-react baseline via `git stash`: identical 42 failures, all in `ocrWorkflow.test.ts`, `ReviewQueueView.test.tsx`, `readerPosition.test.ts` — none reference icons). Migration introduced **0 new failures**.
- [x] 5.4 `npm run build` — succeeds; Phosphor lands in `ui-vendor` chunk (557 kB / 121 kB gzip)
- [ ] 5.5 Visual QA — pending (requires running the app: `npm run tauri:dev` or `npm run dev`); confirm spinners animate, close buttons render, `regular` weight reads well at `w-3`/`w-4` across settings, RSS/media, review/flashcards, Toolbar + TabIcons

## Notes
- Bundle: Phosphor's `regular` weight tree-shakes well; the `ui-vendor` chunk is comparable to the prior lucide chunk. No material bundle-size regression.
- Out of scope (separate follow-up): emoji/ASCII-as-icon cleanup (~30 sites: `⭐`→`Star`, `✓`→`Check`, empty-state `text-6xl` emoji); adopting non-`regular` weights (duotone/fill) for specific surfaces.
