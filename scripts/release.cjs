#!/usr/bin/env node
/**
 * Release helper: bumps the version across all manifest files, prepends a
 * CHANGELOG entry, commits, tags, pushes, and creates a GitHub release.
 *
 * Usage:
 *   node scripts/release.cjs [<new-version>] [--notes <path>]
 *
 * - <new-version>: target semver (e.g. 1.51.0). If omitted, the patch segment
 *   is auto-incremented.
 * - --notes <path>: path to a markdown file whose contents become the release
 *   notes (used for both CHANGELOG.md and the GitHub release body). If omitted,
 *   the script falls back to scripts/release-notes.md, then to a minimal
 *   generic note. The script never hardcodes release-specific copy so it stays
 *   correct release after release.
 *
 * Release notes format (the file's full contents are used verbatim):
 *   ### Added
 *   - ...
 *   ### Fixed & Improved
 *   - ...
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, obj) => fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');

// --- Parse arguments -------------------------------------------------------
let newVersion = null;
let notesPath = path.join(rootDir, 'scripts', 'release-notes.md');
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--notes') {
    notesPath = path.resolve(rootDir, args[++i]);
  } else if (!a.startsWith('--')) {
    newVersion = a;
  }
}

// --- 1. Current version ----------------------------------------------------
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = readJson(packageJsonPath);
const currentVersion = packageJson.version;

if (!newVersion) {
  const parts = currentVersion.split('.');
  parts[2] = parseInt(parts[2], 10) + 1;
  newVersion = parts.join('.');
}

// Guard against re-releasing the same version.
if (newVersion === currentVersion) {
  console.error(`Version is already ${currentVersion}. Aborting.`);
  process.exit(1);
}

console.log(`Bumping version from ${currentVersion} to ${newVersion}...`);

// --- 2. Release notes (data-driven, never hardcoded) ----------------------
let releaseNotes = '';
if (fs.existsSync(notesPath)) {
  releaseNotes = fs.readFileSync(notesPath, 'utf8').trim();
} else {
  releaseNotes = `### Changed\n- Release ${newVersion}.`;
  console.warn(`No release notes found at ${notesPath}; using a placeholder.`);
}

// --- 3. Bump manifests -----------------------------------------------------
packageJson.version = newVersion;
writeJson(packageJsonPath, packageJson);

const packageLockPath = path.join(rootDir, 'package-lock.json');
if (fs.existsSync(packageLockPath)) {
  const packageLock = readJson(packageLockPath);
  packageLock.version = newVersion;
  if (packageLock.packages && packageLock.packages['']) {
    packageLock.packages[''].version = newVersion;
  }
  writeJson(packageLockPath, packageLock);
}

const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = readJson(tauriConfPath);
  tauriConf.version = newVersion;
  writeJson(tauriConfPath, tauriConf);
}

const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoToml = cargoToml.replace(/^version = ".*"/m, `version = "${newVersion}"`);
  fs.writeFileSync(cargoTomlPath, cargoToml, 'utf8');
}

// Cargo.lock references the crate's version in two places (the [[package]]
// name+version block). Bump both so `cargo build` doesn't fail with a stale
// lockfile. Plain text replacement is safe — the old version string is unique
// enough in the lockfile, and the package name is the anchor we match against.
const cargoLockPath = path.join(rootDir, 'src-tauri', 'Cargo.lock');
if (fs.existsSync(cargoLockPath)) {
  let cargoLock = fs.readFileSync(cargoLockPath, 'utf8');
  const pkgBlock = new RegExp(
    '(name = "incrementum-tauri"\\n)version = "' + currentVersion.replace(/\./g, '\\.') + '"'
  );
  if (pkgBlock.test(cargoLock)) {
    cargoLock = cargoLock.replace(pkgBlock, `$1version = "${newVersion}"`);
  } else {
    // Fallback: bump any standalone occurrence of the old version (covers the
    // case where the lock already diverged).
    cargoLock = cargoLock.replace(
      new RegExp('version = "' + currentVersion.replace(/\./g, '\\.') + '"', 'g'),
      `version = "${newVersion}"`
    );
  }
  fs.writeFileSync(cargoLockPath, cargoLock, 'utf8');
}

// --- 4. CHANGELOG (prepend a dated entry; avoid duplicate headers) --------
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
const dateStr = new Date().toISOString().slice(0, 10);
const entry = `## [${newVersion}] - ${dateStr}\n\n${releaseNotes}\n`;
if (fs.existsSync(changelogPath)) {
  let changelog = fs.readFileSync(changelogPath, 'utf8');
  // Don't insert a duplicate if this version was already logged.
  if (!changelog.includes(`## [${newVersion}]`)) {
    changelog = changelog.replace(/^(# Changelog\n\n?)/, `$1${entry}\n`);
    fs.writeFileSync(changelogPath, changelog, 'utf8');
  }
}

console.log('Files updated successfully.');

// --- 5. Commit, tag, push, release ----------------------------------------
try {
  console.log('Staging files...');
  execSync('git add -A', { stdio: 'inherit', cwd: rootDir });

  console.log('Creating commit...');
  const commitMsg = `chore: release v${newVersion}\n\n${releaseNotes}`;
  const commitMsgFile = path.join(rootDir, '.commit-msg.tmp');
  fs.writeFileSync(commitMsgFile, commitMsg, 'utf8');
  execSync(`git commit -F .commit-msg.tmp`, { stdio: 'inherit', cwd: rootDir });
  fs.unlinkSync(commitMsgFile);

  console.log('Creating tag...');
  execSync(`git tag -a v${newVersion} -m "v${newVersion}"`, { stdio: 'inherit', cwd: rootDir });

  console.log('Pushing code and tag to remote...');
  execSync(`git push origin main && git push origin v${newVersion}`, { stdio: 'inherit', cwd: rootDir });

  console.log('Creating GitHub Release...');
  const notesFile = path.join(rootDir, '.release-notes.tmp.md');
  fs.writeFileSync(notesFile, releaseNotes + '\n', 'utf8');
  execSync(`gh release create v${newVersion} -t "v${newVersion}" -F .release-notes.tmp.md`, {
    stdio: 'inherit',
    cwd: rootDir,
  });
  fs.unlinkSync(notesFile);

  console.log(`\nRelease v${newVersion} successfully created!`);
} catch (err) {
  console.error('Git/GitHub release step failed:', err.message);
  console.error('Version files were bumped and committed locally; finish the release manually if needed.');
}
