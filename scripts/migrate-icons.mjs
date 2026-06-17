#!/usr/bin/env node
/**
 * Codemod: migrate lucide-react -> @phosphor-icons/react across src/.
 *
 * Strategy: regex-based import rewrite + identifier rename. lucide imports in
 * this codebase are uniform (`import { A, B as C, type D } from "lucide-react"`),
 * so a structural rewrite is reliable without a full TS parser. Idempotent:
 * re-running on an already-migrated file is a no-op (no lucide-react import found).
 *
 * Per-file transformation:
 *   1. Find every `import { ... } from "lucide-react"` statement (quote-flexible).
 *   2. Parse the specifiers, applying the rename map:
 *        - `Foo`            -> `<mappedFoo or Foo>` (drop if `type LucideIcon`)
 *        - `Foo as Bar`     -> keep local name `Bar`; rename the imported name only
 *        - `type LucideIcon`-> `type IconType`
 *      Dedupe resulting specifiers (e.g. CheckCircle + CheckCircle2 both -> CheckCircle).
 *      Change the module specifier to "@phosphor-icons/react".
 *   3. For each Lucide identifier that was renamed to a DIFFERENT name, replace
 *      whole-word occurrences of that identifier throughout the file body.
 *      (For `Foo as Bar`, only the imported name changed — body uses `Bar`, untouched.)
 *   4. Write the file back. Emit a per-file summary to migrate-report.txt.
 *
 * Usage: node scripts/migrate-icons.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const MAP = JSON.parse(readFileSync(join(ROOT, 'scripts', 'icon-map.json'), 'utf-8'));
const DRY = process.argv.includes('--dry-run');

// Whole-word identifier boundary. Identifiers are [A-Za-z_$][A-Za-z0-9_$]*.
// JS identifiers here are all PascalCase, no $ or digits-leading, so \b is safe.
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Recursively collect .ts/.tsx files under dir. */
function collectTsFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      collectTsFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

// Matches: import { specifiers } from "lucide-react";   (single or double quotes, optional semicolon, optional preceding 'type')
// Captures: [1] = specifier block (between braces)
const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*(['"])lucide-react\2\s*;?/g;

/**
 * Parse a specifier block like "\n  Foo,\n  Bar as Baz,\n  type LucideIcon,\n" into
 * an array of { kind: 'value'|'type', name, as? }.
 */
function parseSpecifiers(block) {
  const specs = [];
  // Split on commas, but be careful: names here never contain commas.
  for (let raw of block.split(',')) {
    raw = raw.replace(/\/\/.*$/g, '').trim();
    if (!raw) continue;
    const isType = /^type\s+/.test(raw);
    const cleaned = raw.replace(/^type\s+/, '').trim();
    if (!cleaned) continue;
    const asMatch = cleaned.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
    if (asMatch) {
      specs.push({ kind: isType ? 'type' : 'value', name: asMatch[1], as: asMatch[2] });
    } else {
      specs.push({ kind: isType ? 'type' : 'value', name: cleaned });
    }
  }
  return specs;
}

/** Transform a single file's source. Returns { code, stats } or null if no lucide import. */
function transformSource(src) {
  let touched = false;
  // collected per-file: lucideName -> newName to rename in body (only value-imports whose name changed)
  const renamesInBody = new Map(); // bodyIdentifier -> newName
  let newCode = src;

  // Reset lastIndex because IMPORT_RE is global and reused.
  IMPORT_RE.lastIndex = 0;
  // Collect all import matches first (handle files with multiple lucide imports),
  // then rebuild. We process matches in order, building replacement segments.
  const matches = [];
  let m;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    matches.push({ index: m.index, length: m[0].length, block: m[1] });
  }
  if (matches.length === 0) return null;

  // Build the merged specifier list across all lucide imports in this file,
  // plus the set of body identifiers that need renaming.
  const merged = new Map(); // key: `${kind}:${localName}` -> { kind, name, as }
  for (const mt of matches) {
    const specs = parseSpecifiers(mt.block);
    for (const s of specs) {
      const localName = s.as || s.name;
      const key = `${s.kind}:${localName}`;
      // Handle LucideIcon type -> Icon (Phosphor's exported type; note: Phosphor
      // has no `IconType` export — the type is named `Icon`).
      if (s.kind === 'type' && s.name === 'LucideIcon') {
        merged.set(key, { kind: 'type', name: 'Icon', as: s.as || undefined });
        if (!s.as) renamesInBody.set('LucideIcon', 'Icon');
        touched = true;
        continue;
      }
      // Also handle value-style `import { LucideIcon }` (no `type` keyword),
      // which Lucide permits. Phosphor has no value `LucideIcon` export — map to
      // `type Icon`. This is a value->type shift; we emit `type Icon` in the import
      // and rename body occurrences LucideIcon -> Icon.
      if (s.kind === 'value' && s.name === 'LucideIcon') {
        merged.set(key, { kind: 'type', name: 'Icon', as: s.as || undefined });
        if (!s.as) renamesInBody.set('LucideIcon', 'Icon');
        touched = true;
        continue;
      }
      const newName = MAP[s.name] || s.name;
      merged.set(key, { kind: s.kind, name: newName, as: s.as });
      // Body rename only when the value identifier itself changed AND no alias shields it.
      // If `Foo as Bar`: body uses Bar; we don't touch Bar. Only the import source name changed.
      if (s.kind === 'value' && !s.as && newName !== s.name) {
        renamesInBody.set(s.name, newName);
      }
      touched = true;
    }
  }

  // Dedupe specifiers: collapse identical {kind,name,as}. Sort for stable output:
  // value imports alphabetically by local name, then type imports.
  const dedup = [];
  const seen = new Set();
  for (const v of merged.values()) {
    const k = `${v.kind}:${v.name}:${v.as || ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(v);
  }
  dedup.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'type' ? 1 : -1;
    return (a.as || a.name).localeCompare(b.as || b.name);
  });

  // Render the new import specifiers, preserving a readable multi-line format if 4+.
  function renderSpec(s) {
    const imported = s.name;
    const local = s.as;
    let inner = s.kind === 'type' ? `type ${imported}` : imported;
    if (local && local !== imported) inner += ` as ${local}`;
    return inner;
  }
  const specStrs = dedup.map(renderSpec);
  let importBody;
  if (specStrs.length >= 4) {
    importBody = '\n  ' + specStrs.join(',\n  ') + ',\n';
  } else {
    importBody = ' ' + specStrs.join(', ') + ' ';
  }
  const newImport = `import {${importBody}} from "@phosphor-icons/react";`;

  // Replace all original lucide imports with a SINGLE merged import at the
  // position of the first match; remove the others.
  let out = '';
  let cursor = 0;
  let replaced = false;
  // Re-iterate matches in source order, rebuilding the string.
  for (const mt of matches) {
    out += src.slice(cursor, mt.index);
    if (!replaced) {
      out += newImport;
      replaced = true;
    }
    cursor = mt.index + mt.length;
    // If the original import had no trailing semicolon but the line had a newline,
    // our replacement already includes one semicolon-free form; preserve nothing extra.
  }
  out += src.slice(cursor);
  newCode = out;

  // Now apply body identifier renames. We must NOT touch the import statement we
  // just wrote. Strategy: apply renames to the whole code, but since the import
  // statement now uses the NEW names already, renaming old->new in the body is safe
  // (the import line no longer contains the old names).
  // Edge: an old name could appear as a property key string or inside a larger
  // identifier — \b word boundaries handle the latter; the former is extremely rare
  // and would show up as a TS error we catch in verification.
  for (const [oldName, newName] of renamesInBody) {
    // word-boundary replace, global
    const re = new RegExp(`\\b${escapeRegex(oldName)}\\b`, 'g');
    newCode = newCode.replace(re, newName);
  }

  return {
    code: newCode,
    stats: {
      importCount: matches.length,
      specifiers: dedup.length,
      bodyRenames: [...renamesInBody.entries()],
    },
  };
}

/** Exported for testing. */
export { transformSource, parseSpecifiers, collectTsFiles };

function main() {
  const files = collectTsFiles(SRC);
  const report = [];
  let migrated = 0;
  let skipped = 0;
  const allBodyRenames = [];

  for (const file of files) {
    const src = readFileSync(file, 'utf-8');
    if (!/from\s*(['"])lucide-react\1/.test(src)) {
      skipped++;
      continue;
    }
    const result = transformSource(src);
    if (!result) {
      skipped++;
      continue;
    }
    migrated++;
    const rel = relative(ROOT, file);
    if (!DRY) writeFileSync(file, result.code);
    report.push(
      `${rel}: ${result.stats.importCount} import(s) -> 1, ${result.stats.specifiers} specs` +
        (result.stats.bodyRenames.length
          ? `, body renames: ${result.stats.bodyRenames.map(([a, b]) => `${a}->${b}`).join('; ')}`
          : '')
    );
    for (const [a, b] of result.stats.bodyRenames) allBodyRenames.push(`${a}->${b} (${rel})`);
  }

  const summary = [
    `Codemod ${DRY ? '(DRY RUN) ' : ''}complete: ${migrated} files migrated, ${skipped} skipped (no lucide import).`,
    `Distinct body-rename operations: ${new Set(allBodyRenames.map(r => r.split(' ')[0])).size}`,
    '',
    ...report,
  ].join('\n');
  if (!DRY) writeFileSync(join(ROOT, 'scripts', 'migrate-report.txt'), summary);
  console.log(summary.split('\n')[0]);
  console.log(`Full report: scripts/migrate-report.txt`);
}

// Run only when invoked directly (not when imported for testing).
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();

