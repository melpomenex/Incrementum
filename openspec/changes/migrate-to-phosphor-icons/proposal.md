# Proposal: Migrate icon library from lucide-react to @phosphor-icons/react

## Intent

The app currently uses `lucide-react@^0.562.0` as its sole icon library (~258 distinct icons across 246 files). Lucide ships outline/stroke icons only. Migrating to `@phosphor-icons/react` unlocks 6 weight variants per icon (Thin, Light, Regular, Bold, Fill, Duotone), giving the design system richer affordances for active/selected states, emphasis, and empty-state illustrations that Lucide cannot express natively. This change performs the dependency swap in one atomic, codemod-driven pass with a single global default weight (`regular`) so the visual outcome is consistent and the diff is reviewable.

## Scope

**In scope:**
- Replace every `lucide-react` import in `src/` with `@phosphor-icons/react`
- Remap all Lucide icon names that differ from Phosphor (~35 renames, e.g. `Trash2`→`Trash`, `Loader2`→`CircleNotch`, `BarChart3`→`ChartBar`)
- Swap the `LucideIcon` type (used in 2 files) for Phosphor's `IconType`
- Remove `lucide-react` from dependencies
- Set a global default weight of `regular` (Phosphor default; no per-icon `weight` props added in this pass)

**Out of scope:**
- Emoji-as-icon cleanup (~30 sites using `⭐`, `✓`, `text-6xl` empty-state emoji) — separate follow-up change
- Adopting non-`regular` weights (duotone/fill) for specific UI surfaces — separate follow-up
- Building a custom `Icon` wrapper component — not required; `className`-based styling ports directly

## Approach

### Why a codemod, not a manual sweep

246 files and ~258 distinct icons make a hand-edit infeasible and error-prone. The migration is mechanical: import rewrites + identifier renames. A Node `ts-morph`-based codemod (`scripts/migrate-icons.mjs`) handles the bulk idempotently and emits a per-file change report for review.

### Why this is low-risk

Verified during investigation:
- **Zero tests affected** — no test imports `lucide-react`, no snapshot tests exist in `src/`, no test asserts on SVG markup or icon classNames.
- **Zero prop translation** — 100% of icons are styled via Tailwind `className` (`w-N h-N`, `text-*`, `animate-spin`), which Phosphor passes through identically. No Lucide-specific props (`strokeWidth`, `absoluteStrokeWidth`, numeric `size`) are used on icon components.
- **Only 2 type sites** — `StatCard.tsx` and `TabIcons.tsx` reference `LucideIcon`.

### Execution order

1. Install `@phosphor-icons/react` (keep `lucide-react` until final pass).
2. Build the Lucide→Phosphor name map (`scripts/migrate-icons-map.ts`).
3. Run the codemod across `src/`.
4. Manually resolve the ~3 config-object typing sites and ~10 visually-ambiguous icons.
5. Remove `lucide-react`.
6. Verify: `tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build`, visual QA.

### Files Changed

- `package.json` / `package-lock.json` — add `@phosphor-icons/react`, remove `lucide-react`
- **~246 files under `src/`** — import rewrites + identifier renames (codemod)
- `src/components/analytics/StatCard.tsx` — `LucideIcon` → `IconType`
- `src/components/tabs/TabIcons.tsx` — `LucideIcon` → `IconType`
- `src/components/import/ImportProgressIndicator.tsx`, `src/components/transcription/TranscriptionButton.tsx`, `src/components/sync/FileSyncStatusIndicator.tsx` — config-object `typeof Loader2` typing
- `scripts/migrate-icons-map.ts`, `scripts/migrate-icons.mjs` — migration tooling (may be removed after)
