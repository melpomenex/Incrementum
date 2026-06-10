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
- **10 Stunning New Themes** — Added 10 brand-new user interface themes (5 dark and 5 light variants).
- **Start Optimal Session Command** — Added a new "Start Optimal Session" command to the command palette.
- **Paste Extract Command** — Added a new "Paste Extract" command to the command palette.
- **Keyboard Shortcut Propagation** — Keyboard shortcuts are now propagated directly to command palette search results.
- **Auto-Reset Playback & Tab History** — Introduced auto-resetting playback for ended/near-ended media alongside active tab history tracking.
- **RSS i18n Translation Keys** — Added i18n translation keys for the RSS dashboard, discover panel, and help overlays.

### Fixed & Improved
- **Podcast Playback Issue** — Resolved a \`NotSupportedError\` when attempting to play podcast audio within macOS WKWebView.
- **Document Viewer Guard** — Guarded \`Node.contains\` against non-Node event targets to prevent crashes in the Document Viewer.
- **RSS Performance & Navigation** — Optimized search/interaction performance and resolved arrow key navigation issues in the RSS view.
- **RSS & Web Browser Translations** — Updated translations for RSS features and web browser tab improvements.

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
- **10 Stunning New Themes** — Added 10 brand-new user interface themes (5 dark and 5 light variants).
- **Start Optimal Session Command** — Added a new "Start Optimal Session" command to the command palette.
- **Paste Extract Command** — Added a new "Paste Extract" command to the command palette.
- **Keyboard Shortcut Propagation** — Keyboard shortcuts are now propagated directly to command palette search results.
- **Auto-Reset Playback & Tab History** — Introduced auto-resetting playback for ended/near-ended media alongside active tab history tracking.
- **RSS i18n Translation Keys** — Added i18n translation keys for the RSS dashboard, discover panel, and help overlays.

### Fixed & Improved
- **Podcast Playback Issue** — Resolved a \`NotSupportedError\` when attempting to play podcast audio within macOS WKWebView.
- **Document Viewer Guard** — Guarded \`Node.contains\` against non-Node event targets to prevent crashes in the Document Viewer.
- **RSS Performance & Navigation** — Optimized search/interaction performance and resolved arrow key navigation issues in the RSS view.
- **RSS & Web Browser Translations** — Updated translations for RSS features and web browser tab improvements.`;

  fs.writeFileSync(notesFile, notes, 'utf8');
  execSync(`gh release create v${newVersion} -t "v${newVersion}" -F release-notes.tmp.md`, { stdio: 'inherit', cwd: rootDir });
  fs.unlinkSync(notesFile);

  console.log(`\nRelease v${newVersion} successfully created!`);
} catch (err) {
  console.error('Git/GitHub release execution failed:', err.message);
}
