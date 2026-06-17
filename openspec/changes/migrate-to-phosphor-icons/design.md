# Design: Migrate icon library from lucide-react to @phosphor-icons/react

## Architecture

Icon usage in the app is uniform: every icon is a named import from `lucide-react`, rendered as `<IconName className="w-N h-N text-* …" />`. There is no custom `Icon` wrapper component. The only centralization is `src/components/tabs/TabIcons.tsx`, a thin registry mapping tab keys to icon components with a `createTabIcon(Icon, className)` helper.

Styling is 100% Tailwind `className`-based. Sizing (`w-N h-N`), color (`text-*`), and animation (`animate-spin` on spinners) are applied via class, never via Lucide props. This means Phosphor's `className` passthrough reproduces the styling identically with no translation.

## Name-Mapping Strategy

Phosphor names align with Lucide for the majority of icons (e.g. `X`, `Check`, `Star`, `Eye`, `Search`, `Plus`, `Play`, `Sun`, `Moon`, `Bell`, `Heart`, `Lock`, `Copy`, `Save`). These need only an import-source change.

~35 icons have different names and require identifier-level rename (not just JSX):

| Lucide | Phosphor | Notes |
|---|---|---|
| `BarChart3` | `ChartBar` | analytics, high usage |
| `BarChart` | `ChartBarHorizontal` | keep distinct from `BarChart3` |
| `FileText` | `TextT` | one of most-used icons |
| `Layers` | `Stack` | |
| `Sparkles` | `Sparkle` | AI features |
| `AlertCircle` | `WarningCircle` | |
| `AlertTriangle` | `Warning` | |
| `ExternalLink` | `ArrowSquareOut` | |
| `RefreshCw` | `ArrowsClockwise` | |
| `RefreshCcw` | `ArrowsCounterClockwise` | |
| `MoreVertical` | `DotsThreeVertical` | |
| `MoreHorizontal` | `DotsThree` | |
| `RotateCcw` | `ArrowCounterClockwise` | |
| `RotateCw` | `ArrowClockwise` | |
| `Network` | `Graph` | graph panels |
| `ChevronRight/Left/Up/Down` | `CaretRight/Left/Up/Down` | high usage |
| `CheckCircle` / `CheckCircle2` | `CheckCircle` | collapse both → one |
| `Trash2` | `Trash` | no `Trash2` in Phosphor |
| `Edit2` / `Edit3` | `PencilSimple` | |
| `Edit` | `Pencil` | |
| `MessageSquarePlus` | `ChatCircleDots` | |
| `Loader2` | `CircleNotch` | see spinner decision below |
| `LayoutDashboard` | `SquaresFour` | |
| `Repeat1` | `Repeat` | |
| `Settings2` | `Sliders` | |
| `BookmarkPlus` | `BookmarkSimple` | |
| `BellOff` | `BellSlash` | |
| `Wand2` | `Sparkle` | |
| `Maximize2` | `ArrowsOutSimple` | review against viewer usage |
| `Minimize2` | `ArrowsInSimple` | review against viewer usage |

Aliases to preserve during rename (the `as` form must keep its local name, only the source identifier changes): `SettingsIcon`→Settings, `CommandIcon`→Command, `ImageIcon`→Image, `FileTextIcon`→FileText, `TagIcon`→Tag, `LinkIcon`→Link, `SearchIcon`→Search, `BookmarkIcon`→Bookmark.

## Codemod Approach (`scripts/migrate-icons.mjs`)

Uses `ts-morph` to parse each `.ts`/`.tsx` under `src/` that imports from `lucide-react`:

1. **Resolve specifiers** — for each named import (including `… as Alias` forms), look up the Lucide name in the map.
2. **Rewrite the import** — change the module specifier to `@phosphor-icons/react`; rename mapped specifiers; collapse `CheckCircle`/`CheckCircle2` to a single `CheckCircle` import (dedupe).
3. **Rename identifiers file-wide** — `SourceFile.forEachDescendant` renaming references to each old identifier to its new name. This catches JSX (`<Loader2>`), object values (`icon: Loader2`), type refs (`typeof Loader2`), and conditional rendering (`{Loader2 && …}`) in one pass.
4. **Type swap** — `LucideIcon` import → `IconType`; references follow via the same rename pass.
5. **Preserve formatting** — keep multi-line import blocks and `as` aliases.
6. **Report** — write a per-file change log to `scripts/migrate-report.txt`.

The codemod is idempotent: re-running on an already-migrated file finds no `lucide-react` import and is a no-op.

## Spinner Decision: `Loader2` → `CircleNotch`

Phosphor has no exact equivalent of Lucide's `Loader2` (a 2-arc spinner glyph). The spin motion comes entirely from the Tailwind `animate-spin` utility, never from the icon itself. `CircleNotch` (a single open arc) is the closest visual match and reads well at small sizes when spinning.

- **176 render sites** across 90 files — all use `<Loader2 className="… animate-spin …" />`. Swapping the component and keeping `animate-spin` preserves motion exactly.
- **3 config-object sites** store `Loader2` as a value in a `Record`/config (`ImportProgressIndicator.tsx:32`, `TranscriptionButton.tsx:284`, `FileSyncStatusIndicator.tsx:45`) with typing like `typeof Loader2` — these need the type ref updated to `IconType` or `typeof CircleNotch` after the codemod's identifier rename.

Fallback if `CircleNotch` looks too sparse at `w-3` during visual QA: `Spinner` or `SpinnerGap` (Phosphor dedicated spinner glyphs).

## Type Swap: `LucideIcon` → `IconType`

Only two files reference the type:
- `src/components/analytics/StatCard.tsx:2,7` — `import { LucideIcon }` → `icon: LucideIcon`
- `src/components/tabs/TabIcons.tsx:25,29` — `type LucideIcon` → `createTabIcon(Icon: LucideIcon, …)`

Both become `IconType` from `@phosphor-icons/react`. Phosphor's `IconType` is a `ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>`, structurally compatible with how the type is used (a renderable icon component accepting `className`).

## Ambiguous-Icon Resolution (Phase 3)

Icons where the Phosphor equivalent differs visually from Lucide's "2"/"3" numbered variants require a judgment call against actual usage:
- `Maximize2` / `Minimize2` — used in viewer/reader windows for fullscreen toggles. Lucide's "2" variant is the corner-bracket expand/collapse. Phosphor's `Maximize`/`Minimize` are square-outline variants; `ArrowsOutSimple`/`ArrowsInSimple` (diagonal arrows) may match better. Decision made during visual QA.
- `BarChart` vs `BarChart3` — both map to distinct Phosphor names (`ChartBarHorizontal` / `ChartBar`) to avoid collapsing two semantically different icons into one.
- Any Lucide icon with no Phosphor export surfaces as a `TS2305: Module has no exported member` error after the codemod — resolved by picking the closest substitute and adding it to the map.

## Testing

- `npx tsc --noEmit` — zero type errors (catches missing Phosphor exports, `IconType` mismatches)
- `npm run lint` — clean
- `npm run test:run` — green (suite is icon-library-agnostic; no behavioral change expected)
- `npm run build` — production build succeeds; spot-check bundle size (Phosphor `regular` weight tree-shakes comparably to Lucide)
- Visual QA on the four heaviest surfaces: settings panels, RSS/media reader, review/flashcard module, `Toolbar` + `TabIcons` navigation. Confirm spinners still animate, close buttons render, `regular` weight reads well at `w-3`/`w-4`.
