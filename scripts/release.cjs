#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

// Helper to read JSON
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Helper to write JSON
const writeJson = (filePath, obj) => fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');

// 1. Get current version
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = readJson(packageJsonPath);
const currentVersion = packageJson.version;

// 2. Parse arguments for new version
let newVersion = process.argv[2];
if (!newVersion) {
  // Auto-bump patch version
  const parts = currentVersion.split('.');
  parts[2] = parseInt(parts[2], 10) + 1;
  newVersion = parts.join('.');
}

console.log(`Bumping version from ${currentVersion} to ${newVersion}...`);

// 3. Update package.json
packageJson.version = newVersion;
writeJson(packageJsonPath, packageJson);

// 4. Update package-lock.json
const packageLockPath = path.join(rootDir, 'package-lock.json');
if (fs.existsSync(packageLockPath)) {
  const packageLock = readJson(packageLockPath);
  packageLock.version = newVersion;
  if (packageLock.packages && packageLock.packages['']) {
    packageLock.packages[''].version = newVersion;
  }
  writeJson(packageLockPath, packageLock);
}

// 5. Update tauri.conf.json
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = readJson(tauriConfPath);
  tauriConf.version = newVersion;
  writeJson(tauriConfPath, tauriConf);
}

// 6. Update Cargo.toml
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoToml = cargoToml.replace(/^version = ".*"/m, `version = "${newVersion}"`);
  fs.writeFileSync(cargoTomlPath, cargoToml, 'utf8');
}

// 7. Update CHANGELOG.md
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
if (fs.existsSync(changelogPath)) {
  let changelog = fs.readFileSync(changelogPath, 'utf8');
  const dateStr = new Date().toISOString().slice(0, 10);
  
  // Format the release note
  const releaseHeader = `## [${newVersion}] - ${dateStr}

### Added
- **Vim Text Objects & Operator-Pending Verbs** — Select and act on text with canonical vim motions: \`aw\`/\`iw\` (word), \`as\`/\`is\` (sentence), \`ap\`/\`ip\` (paragraph), plus \`d\`/\`c\`/\`y\` operators (\`daw\`, \`cip\`, \`yy\`, \`dd\`).
- **WORD vs word Motions** — Lowercase \`w\`/\`b\`/\`e\` now stop on punctuation; uppercase \`W\`/\`B\`/\`E\` skip to the next whitespace-delimited WORD.
- **Vimium \`:\` Command-Bar Capture** — Create extracts and flashcards without leaving the keyboard: \`:extract\`, \`:flashcard\`, \`:cloze\`, \`:qa\`, \`:mchoice\`, \`:extract2card\`, \`:highlight [color]\`, \`:deck <name>\`.
- **Extract → Flashcard Chain** — After any instant extract, press \`gf\` to open Flashcard Studio seeded from that extract.
- **Configurable Default Card Type** — Choose whether vim's \`F\` key and \`:flashcard\` seed Q&A, Cloze, or Multiple-choice (Settings → Keyboard Shortcuts → Vim Reading).

### Fixed & Improved
- **Vim Selection Context** — Vim-triggered captures now carry a full \`SelectionContext\` (page numbers, offsets) read from the live DOM selection instead of stale React state.
- **Visual-Mode Caret Visibility** — The caret overlay now survives React re-renders triggered by \`selectionchange\`, re-appends via \`requestAnimationFrame\`, and renders above the PDF text layer (z-index 9000).
- **Post-Action Cursor Reset** — After any capture action, the cursor returns to the selection start and the mode resets to normal.

`;

  // Insert right after "# Changelog\n\n" or at the top
  changelog = changelog.replace(/^(# Changelog\n\n)?/, `$1${releaseHeader}`);
  fs.writeFileSync(changelogPath, changelog, 'utf8');
}

console.log('Files updated successfully.');

// Git commands
try {
  console.log('Staging files...');
  execSync('git add .', { stdio: 'inherit', cwd: rootDir });
  
  console.log('Creating commit...');
  execSync(`git commit -m "chore: release v${newVersion}"`, { stdio: 'inherit', cwd: rootDir });
  
  console.log('Creating tag...');
  execSync(`git tag -a v${newVersion} -m "v${newVersion}"`, { stdio: 'inherit', cwd: rootDir });
  
  console.log('Pushed code and tag to remote...');
  execSync(`git push origin main && git push origin v${newVersion}`, { stdio: 'inherit', cwd: rootDir });

  // Create GitHub Release draft
  console.log('Creating GitHub Release draft...');
  const notesFile = path.join(rootDir, 'release-notes.tmp.md');
  const notes = `### Added
- **Vim Text Objects & Operator-Pending Verbs** — Select and act on text with canonical vim motions: \`aw\`/\`iw\` (word), \`as\`/\`is\` (sentence), \`ap\`/\`ip\` (paragraph), plus \`d\`/\`c\`/\`y\` operators (\`daw\`, \`cip\`, \`yy\`, \`dd\`).
- **WORD vs word Motions** — Lowercase \`w\`/\`b\`/\`e\` now stop on punctuation; uppercase \`W\`/\`B\`/\`E\` skip to the next whitespace-delimited WORD.
- **Vimium \`:\` Command-Bar Capture** — Create extracts and flashcards without leaving the keyboard: \`:extract\`, \`:flashcard\`, \`:cloze\`, \`:qa\`, \`:mchoice\`, \`:extract2card\`, \`:highlight [color]\`, \`:deck <name>\`.
- **Extract → Flashcard Chain** — After any instant extract, press \`gf\` to open Flashcard Studio seeded from that extract.
- **Configurable Default Card Type** — Choose whether vim's \`F\` key and \`:flashcard\` seed Q&A, Cloze, or Multiple-choice (Settings → Keyboard Shortcuts → Vim Reading).

### Fixed & Improved
- **Vim Selection Context** — Vim-triggered captures now carry a full \`SelectionContext\` (page numbers, offsets) read from the live DOM selection instead of stale React state.
- **Visual-Mode Caret Visibility** — The caret overlay now survives React re-renders triggered by \`selectionchange\`, re-appends via \`requestAnimationFrame\`, and renders above the PDF text layer (z-index 9000).
- **Post-Action Cursor Reset** — After any capture action, the cursor returns to the selection start and the mode resets to normal.`;

  fs.writeFileSync(notesFile, notes, 'utf8');
  execSync(`gh release create v${newVersion} -t "v${newVersion}" -F release-notes.tmp.md`, { stdio: 'inherit', cwd: rootDir });
  fs.unlinkSync(notesFile);

  console.log(`\nRelease v${newVersion} successfully created!`);
} catch (err) {
  console.error('Git/GitHub release execution failed:', err.message);
}
