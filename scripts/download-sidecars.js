import fs from 'fs';
import path, { dirname } from "path";
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BIN_DIR = path.join(__dirname, '../src-tauri/bin');

if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

function dereferenceAbsoluteSymlinks(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      dereferenceAbsoluteSymlinks(fullPath);
    } else if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(fullPath);
      if (path.isAbsolute(target) && fs.existsSync(target)) {
        const stat = fs.statSync(target);
        fs.rmSync(fullPath);
        if (stat.isDirectory()) {
          fs.cpSync(target, fullPath, { recursive: true });
        } else {
          fs.copyFileSync(target, fullPath);
        }
      }
    }
  }
}

function getTargetTriple() {
  const envTarget = process.env.TARGET_TRIPLE
    || process.env.TAURI_ENV_TARGET_TRIPLE
    || process.env.CARGO_BUILD_TARGET;
  if (envTarget && envTarget.trim()) {
    return envTarget.trim();
  }

  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    // process.arch on Windows runners is x64; arm64 Windows isn't targeted yet.
    return arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
  } else if (platform === 'darwin') {
    return arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
  } else if (platform === 'linux') {
    // Derive the target triple from the host arch rather than hardcoding x86_64.
    // The linux-aarch64 job runs on an arm64 runner (process.arch === 'arm64'),
    // so it must produce aarch64-unknown-linux-gnu sidecars. Previously this
    // always returned x86_64-unknown-linux-gnu, which made the "already exists"
    // short-circuit match the committed x86_64 sidecars and skip provisioning
    // aarch64 ones — Tauri then failed with "resource path
    // `bin/whisper-aarch64-unknown-linux-gnu` doesn't exist".
    const linuxArch = arch === 'arm64' ? 'aarch64' : 'x86_64';
    return `${linuxArch}-unknown-linux-gnu`;
  }

  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

function isMobileTargetTriple(targetTriple) {
  return /android|ios/.test(targetTriple);
}

function sidecarExecutableName(baseName, targetTriple) {
  const ext = targetTriple.includes('windows') ? '.exe' : '';
  return `${baseName}-${targetTriple}${ext}`;
}

function ensureWhisperSource() {
  if (fs.existsSync(path.join('whisper.cpp', 'CMakeLists.txt'))) {
    return;
  }

  // If whisper.cpp directory exists but doesn't have CMakeLists.txt, it's corrupted - remove it
  if (fs.existsSync('whisper.cpp')) {
    console.log('Removing corrupted whisper.cpp directory...');
    fs.rmSync('whisper.cpp', { recursive: true, force: true });
  }

  try {
    execSync('git submodule update --init --recursive whisper.cpp');
  } catch {
    // ignore and fallback to clone
  }

  if (!fs.existsSync(path.join('whisper.cpp', 'CMakeLists.txt'))) {
    execSync('git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git');
  }
}

// Pinned sherpa-onnx version. NOTE: do NOT use the /releases/latest API endpoint
// for this repo — it is stale. Bump this explicitly and update the asset map below.
const SHERPA_ONNX_VERSION = 'v1.12.24';

// Map a target triple to the sherpa-onnx prebuilt tarball asset for that platform.
// Returns null for unsupported targets (the caller skips provisioning there).
// NOTE: asset names are verified against the v1.12.24 release — they are NOT uniform
// (Linux aarch64 has a `-cpu` suffix the others lack; Windows uses MSVC runtime
// variants like `-MD-Release`). Update this map explicitly when bumping
// SHERPA_ONNX_VERSION.
function sherpaAssetForTarget(targetTriple) {
  // macOS arm64 / x86_64: the `-jni` bundles contain bin/sherpa-onnx-offline + lib/libonnxruntime.
  if (targetTriple === 'aarch64-apple-darwin') {
    return { asset: `sherpa-onnx-${SHERPA_ONNX_VERSION}-osx-arm64-jni.tar.bz2`, os: 'macos' };
  }
  if (targetTriple === 'x86_64-apple-darwin') {
    return { asset: `sherpa-onnx-${SHERPA_ONNX_VERSION}-osx-x86_64-jni.tar.bz2`, os: 'macos' };
  }
  if (targetTriple === 'x86_64-unknown-linux-gnu') {
    return { asset: `sherpa-onnx-${SHERPA_ONNX_VERSION}-linux-x64-shared.tar.bz2`, os: 'linux' };
  }
  if (targetTriple === 'aarch64-unknown-linux-gnu') {
    // NOTE: the aarch64 Linux asset has a `-cpu` suffix (the x64 one does not).
    return { asset: `sherpa-onnx-${SHERPA_ONNX_VERSION}-linux-aarch64-shared-cpu.tar.bz2`, os: 'linux' };
  }
  if (targetTriple.includes('windows')) {
    // Windows ships MSVC-runtime variants. MD-Release = dynamic CRT release build,
    // the right default for a normal Windows desktop (MT statically links the CRT
    // and can conflict with the app's own runtime).
    return { asset: `sherpa-onnx-${SHERPA_ONNX_VERSION}-win-x64-shared-MD-Release.tar.bz2`, os: 'windows' };
  }
  return null;
}

/// Download + provision the sherpa-onnx sidecar for the given target triple.
/// The upstream tarball ships a `bin/sherpa-onnx-offline` executable plus a
/// `lib/libonnxruntime.<ver>.{dylib,so,dll}`. We:
///   1. Download + extract the tarball.
///   2. Copy `bin/sherpa-onnx-offline` to `<BIN_DIR>/sherpa-onnx-<triple>` (Tauri externalBin naming).
///   3. Copy the onnxruntime shared lib into <BIN_DIR> alongside it, so the
///      @executable_path / @executable_path/../Resources/bin rpaths resolve it
///      the same way whisper's libwhisper/libggml dylibs are resolved.
///   4. On macOS, add the dev + prod rpaths and re-sign (build.rs redoes this on
///      every build too, but doing it here makes the binary runnable immediately).
function ensureSherpaSidecar(targetTriple) {
  const sherpaName = `sherpa-onnx-${targetTriple}`;
  const sherpaPath = path.join(BIN_DIR, sherpaName);
  if (fs.existsSync(sherpaPath)) {
    return;
  }

  const assetInfo = sherpaAssetForTarget(targetTriple);
  if (!assetInfo) {
    console.warn(`⚠️  sherpa-onnx has no prebuilt asset for ${targetTriple}; skipping.`);
    return;
  }

  const url = `https://github.com/k2-fsa/sherpa-onnx/releases/download/${SHERPA_ONNX_VERSION}/${assetInfo.asset}`;
  const tmpDir = path.join(BIN_DIR, '.sherpa-extract');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    console.log(`Downloading sherpa-onnx ${SHERPA_ONNX_VERSION} for ${targetTriple}...`);
    const archive = path.join(tmpDir, assetInfo.asset);
    execSync(`curl -fL --retry 3 --retry-delay 2 --max-time 300 ${shellQuote(url)} -o ${shellQuote(archive)}`, { stdio: 'inherit' });
    execSync(`tar -xjf ${shellQuote(archive)} -C ${shellQuote(tmpDir)}`, { stdio: 'inherit' });

    // Find the extracted top-level dir (sherpa-onnx-<ver>-<os>-<arch>-...).
    const extracted = fs.readdirSync(tmpDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('sherpa-onnx-'))
      .map(e => path.join(tmpDir, e.name))
      .find(p => fs.existsSync(path.join(p, 'bin')));
    if (!extracted) throw new Error('sherpa-onnx tarball did not contain a bin/ directory');

    // 1. Rename the offline CLI executable to the Tauri externalBin convention.
    const offlineBinCandidates = [
      path.join(extracted, 'bin', 'sherpa-onnx-offline'),
      path.join(extracted, 'bin', 'sherpa-onnx-offline.exe'),
    ];
    const offlineBin = offlineBinCandidates.find(c => fs.existsSync(c));
    if (!offlineBin) throw new Error('sherpa-onnx tarball missing bin/sherpa-onnx-offline');
    fs.copyFileSync(offlineBin, sherpaPath);

    // 2. Copy the onnxruntime shared lib into BIN_DIR (next to whisper's dylibs).
    //    The build.rs rpath patching (@executable_path + @executable_path/../Resources/bin)
    //    resolves it from there in both dev and bundled-.app layouts.
    const libDir = path.join(extracted, 'lib');
    if (fs.existsSync(libDir)) {
      for (const f of fs.readdirSync(libDir)) {
        if (f.startsWith('libonnxruntime') || f.startsWith('onnxruntime')) {
          fs.copyFileSync(path.join(libDir, f), path.join(BIN_DIR, f));
        }
      }
    }

    // 3. On macOS, add rpaths + re-sign so the binary is runnable as-is.
    //    build.rs will also do this on every cargo build; doing it here too means
    //    the sidecar works even before a cargo build runs.
    if (assetInfo.os === 'macos') {
      try {
        execSync(`install_name_tool -add_rpath @executable_path ${shellQuote(sherpaPath)}`, { stdio: 'ignore' });
      } catch { /* rpath may already exist */ }
      try {
        execSync(`install_name_tool -add_rpath @executable_path/../Resources/bin ${shellQuote(sherpaPath)}`, { stdio: 'ignore' });
      } catch { /* rpath may already exist */ }
      try {
        execSync(`codesign --force --sign - ${shellQuote(sherpaPath)}`, { stdio: 'ignore' });
      } catch { /* codesign best-effort */ }
    }

    // On Linux, set RPATH=$ORIGIN so the binary finds libonnxruntime.so in the
    // same directory without needing LD_LIBRARY_PATH at runtime. (Matches how the
    // whisper Linux sidecar is handled.) patchelf may not be installed in every
    // build env; the LD_LIBRARY_PATH fallback in engine.rs covers that case.
    if (assetInfo.os === 'linux') {
      try {
        execSync(`patchelf --set-rpath '$ORIGIN' ${shellQuote(sherpaPath)}`, { stdio: 'ignore' });
      } catch {
        console.log('Note: patchelf not available for sherpa-onnx; relying on LD_LIBRARY_PATH at runtime');
      }
    }

    fs.chmodSync(sherpaPath, 0o755);
    console.log(`sherpa-onnx sidecar provisioned at ${sherpaPath}`);
  } catch (err) {
    console.warn(`⚠️  sherpa-onnx provisioning failed for ${targetTriple}: ${err.message}`);
    console.warn('   Parakeet local transcription will be unavailable. Whisper/Groq still work.');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function commandExists(cmd) {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${cmd}`, { stdio: 'ignore' });
    } else {
      execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function downloadFile(urls, outputPath) {
  const failures = [];

  for (const url of urls) {
    try {
      console.log(`Downloading ${url}...`);
      execSync(
        `curl -fL --retry 3 --retry-delay 2 --connect-timeout 20 --max-time 180 ${shellQuote(url)} -o ${shellQuote(outputPath)}`,
        { stdio: 'inherit' },
      );
      return;
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
      try {
        fs.unlinkSync(outputPath);
      } catch {
        // best-effort cleanup
      }
      console.warn(`Download failed for ${url}; trying next source if available.`);
    }
  }

  throw new Error(`Failed to download ${outputPath}:\n${failures.join('\n')}`);
}

function findFileRecursive(rootDir, fileName) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isFile() && entry.name === fileName) {
      return entryPath;
    }
    if (entry.isDirectory()) {
      const found = findFileRecursive(entryPath, fileName);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function resolvePythonCommand() {
  if (process.platform === 'win32') {
    try {
      execSync('py -3 --version', { stdio: 'ignore' });
      return 'py -3';
    } catch {
      // keep trying fallbacks
    }
  }

  if (commandExists('python3')) {
    return 'python3';
  }
  if (commandExists('python')) {
    return 'python';
  }
  return null;
}

function notebookLMRuntimeLayout(targetTriple) {
  const runtimeDir = path.join(BIN_DIR, 'notebooklm-runtime', targetTriple);
  const pythonHome = path.join(runtimeDir, 'python');
  const runtimePy = process.platform === 'win32'
    ? path.join(pythonHome, 'python.exe')
    : path.join(pythonHome, 'bin', 'python3');
  const sitePackages = path.join(runtimeDir, 'site-packages');
  const playwrightDir = path.join(runtimeDir, 'playwright');
  const manifestPath = path.join(runtimeDir, 'runtime-manifest.json');
  return { runtimeDir, pythonHome, runtimePy, sitePackages, playwrightDir, manifestPath };
}

function renderNotebookLMLauncherScript(targetTriple) {
  return (
    '#!/bin/sh\n' +
    'set -eu\n' +
    'SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\n' +
    `RUNTIME_BASE="$SCRIPT_DIR/notebooklm-runtime/${targetTriple}"\n` +
    'RUNTIME_PY="$RUNTIME_BASE/python/bin/python3"\n' +
    'RUNTIME_SITE="$RUNTIME_BASE/site-packages"\n' +
    'RUNTIME_PLAYWRIGHT="$RUNTIME_BASE/playwright"\n' +
    'if [ -x "$RUNTIME_PY" ] && [ -d "$RUNTIME_SITE" ]; then\n' +
    '  export PYTHONHOME="$RUNTIME_BASE/python"\n' +
    '  export PYTHONPATH="$RUNTIME_SITE"\n' +
    '  export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$RUNTIME_PLAYWRIGHT}"\n' +
    '  exec "$RUNTIME_PY" -m notebooklm.notebooklm_cli "$@"\n' +
    'fi\n' +
    `LEGACY_BUNDLED="$SCRIPT_DIR/notebooklm-runtime/${targetTriple}/.venv/bin/notebooklm"\n` +
    'if [ -x "$LEGACY_BUNDLED" ]; then\n' +
    '  exec "$LEGACY_BUNDLED" "$@"\n' +
    'fi\n' +
    'if [ -n "${HOME:-}" ] && [ -d "$HOME/.local/bin" ]; then\n' +
    '  PATH="$PATH:$HOME/.local/bin"\n' +
    'fi\n' +
    'PATH="$PATH:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\n' +
    'export PATH\n' +
    'for CANDIDATE in "${HOME:-}/.local/bin/notebooklm" /usr/local/bin/notebooklm /usr/bin/notebooklm /bin/notebooklm; do\n' +
    '  if [ -x "$CANDIDATE" ]; then\n' +
    '    if [ "$(dirname -- "$CANDIDATE")" != "$SCRIPT_DIR" ]; then\n' +
    '      exec "$CANDIDATE" "$@"\n' +
    '    fi\n' +
    '  fi\n' +
    'done\n' +
    'RESOLVED_PATH=""\n' +
    'OLD_IFS="$IFS"\n' +
    'IFS=":"\n' +
    'for DIR in $PATH; do\n' +
    '  if [ -x "$DIR/notebooklm" ] && [ ! -d "$DIR/notebooklm" ]; then\n' +
    '    if [ "$DIR" != "$SCRIPT_DIR" ]; then\n' +
    '      RESOLVED_PATH="$DIR/notebooklm"\n' +
    '      break\n' +
    '    fi\n' +
    '  fi\n' +
    'done\n' +
    'IFS="$OLD_IFS"\n' +
    'if [ -n "$RESOLVED_PATH" ]; then\n' +
    '  exec "$RESOLVED_PATH" "$@"\n' +
    'else\n' +
    '  echo "error: notebooklm is not installed" >&2\n' +
    '  echo "Install it with:  pip install notebooklm-py" >&2\n' +
    '  exit 1\n' +
    'fi\n'
  );
}

function writeNotebookLMLauncher(sidecarPath, targetTriple) {
  fs.writeFileSync(sidecarPath, renderNotebookLMLauncherScript(targetTriple));
  fs.chmodSync(sidecarPath, 0o755);
}

function hasPortableNotebookLMRuntime(targetTriple) {
  const { runtimePy, sitePackages, manifestPath } = notebookLMRuntimeLayout(targetTriple);
  if (!fs.existsSync(runtimePy) || !fs.existsSync(sitePackages) || !fs.existsSync(manifestPath)) {
    return false;
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest.layout === 'portable-python-home-v1';
  } catch {
    return false;
  }
}

// ============ Pocket TTS Sidecar Support ============

function pocketTTSRuntimeLayout(targetTriple) {
  const runtimeDir = path.join(BIN_DIR, 'pocket-tts-runtime', targetTriple);
  const pythonHome = path.join(runtimeDir, 'python');
  const runtimePy = process.platform === 'win32'
    ? path.join(pythonHome, 'python.exe')
    : path.join(pythonHome, 'bin', 'python3');
  const sitePackages = path.join(runtimeDir, 'site-packages');
  const manifestPath = path.join(runtimeDir, 'runtime-manifest.json');
  return { runtimeDir, pythonHome, runtimePy, sitePackages, manifestPath };
}

function renderPocketTTSLauncherScript(targetTriple) {
  return (
    '#!/bin/sh\n' +
    'set -eu\n' +
    '# Check for --text-file and transform into --text by reading the file\n' +
    'TEXT_FILE=""\n' +
    'skip=false\n' +
    'argc=$#\n' +
    'i=0\n' +
    'while [ $i -lt $argc ]; do\n' +
    '  arg="$1"\n' +
    '  shift\n' +
    '  i=$((i + 1))\n' +
    '  if $skip; then\n' +
    '    skip=false\n' +
    '    TEXT_FILE="$arg"\n' +
    '    continue\n' +
    '  fi\n' +
    '  case "$arg" in\n' +
    '    --text-file)\n' +
    '      skip=true\n' +
    '      ;;\n' +
    '    --text-file=*)\n' +
    '      TEXT_FILE="${arg#--text-file=}"\n' +
    '      ;;\n' +
    '    *)\n' +
    '      set -- "$@" "$arg"\n' +
    '      ;;\n' +
    '  esac\n' +
    'done\n' +
    'if [ -n "$TEXT_FILE" ] && [ -f "$TEXT_FILE" ]; then\n' +
    '  set -- "$@" "--text" "$(cat "$TEXT_FILE")"\n' +
    '  rm -f "$TEXT_FILE"\n' +
    'fi\n' +
    'SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\n' +
    `RUNTIME_BASE="$SCRIPT_DIR/pocket-tts-runtime/${targetTriple}"\n` +
    'RUNTIME_PY="$RUNTIME_BASE/python/bin/python3"\n' +
    'RUNTIME_SITE="$RUNTIME_BASE/site-packages"\n' +
    'if [ -x "$RUNTIME_PY" ] && [ -d "$RUNTIME_SITE" ]; then\n' +
    '  export PYTHONHOME="$RUNTIME_BASE/python"\n' +
    '  export PYTHONPATH="$RUNTIME_SITE"\n' +
    '  exec "$RUNTIME_PY" -m pocket_tts "$@"\n' +
    'fi\n' +
    'if [ -n "${HOME:-}" ] && [ -d "$HOME/.local/bin" ]; then\n' +
    '  PATH="$PATH:$HOME/.local/bin"\n' +
    'fi\n' +
    'PATH="$PATH:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\n' +
    'export PATH\n' +
    'for CANDIDATE in "${HOME:-}/.local/bin/pocket-tts" /usr/local/bin/pocket-tts /usr/bin/pocket-tts /bin/pocket-tts; do\n' +
    '  if [ -x "$CANDIDATE" ]; then\n' +
    '    if [ "$(dirname -- "$CANDIDATE")" != "$SCRIPT_DIR" ]; then\n' +
    '      exec "$CANDIDATE" "$@"\n' +
    '    fi\n' +
    '  fi\n' +
    'done\n' +
    'RESOLVED_PATH=""\n' +
    'OLD_IFS="$IFS"\n' +
    'IFS=":"\n' +
    'for DIR in $PATH; do\n' +
    '  if [ -x "$DIR/pocket-tts" ] && [ ! -d "$DIR/pocket-tts" ]; then\n' +
    '    if [ "$DIR" != "$SCRIPT_DIR" ]; then\n' +
    '      RESOLVED_PATH="$DIR/pocket-tts"\n' +
    '      break\n' +
    '    fi\n' +
    '  fi\n' +
    'done\n' +
    'IFS="$OLD_IFS"\n' +
    'if [ -n "$RESOLVED_PATH" ]; then\n' +
    '  exec "$RESOLVED_PATH" "$@"\n' +
    'else\n' +
    '  echo "error: pocket_tts is not installed" >&2\n' +
    '  echo "Install it with:  uv tool install pocket-tts" >&2\n' +
    '  echo "Or with pip:      pip install pocket-tts" >&2\n' +
    '  exit 1\n' +
    'fi\n'
  );
}

function writePocketTTSLauncher(sidecarPath, targetTriple) {
  fs.writeFileSync(sidecarPath, renderPocketTTSLauncherScript(targetTriple));
  fs.chmodSync(sidecarPath, 0o755);
}

function hasPortablePocketTTSRuntime(targetTriple) {
  const { runtimePy, sitePackages, manifestPath } = pocketTTSRuntimeLayout(targetTriple);
  if (!fs.existsSync(runtimePy) || !fs.existsSync(sitePackages) || !fs.existsSync(manifestPath)) {
    return false;
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest.layout === 'portable-python-home-v1';
  } catch {
    return false;
  }
}

function buildPortablePocketTTSRuntime(targetTriple, pythonCmd) {
  const { runtimeDir, pythonHome, runtimePy, sitePackages, manifestPath } = pocketTTSRuntimeLayout(targetTriple);
  const buildInfo = getPythonBuildInfo(pythonCmd);
  const pyMajorMinor = `${buildInfo.major}.${buildInfo.minor}`;
  const stdlibDest = path.join(pythonHome, 'lib', `python${pyMajorMinor}`);
  const pyBinDir = process.platform === 'win32' ? pythonHome : path.join(pythonHome, 'bin');

  fs.rmSync(runtimeDir, { recursive: true, force: true });
  fs.mkdirSync(pyBinDir, { recursive: true });
  fs.mkdirSync(sitePackages, { recursive: true });

  fs.copyFileSync(buildInfo.executable, runtimePy);
  if (process.platform !== 'win32') {
    fs.chmodSync(runtimePy, 0o755);
    try {
      fs.symlinkSync('python3', path.join(pyBinDir, 'python'));
    } catch {
      // ignore if symlink cannot be created
    }
  }

  fs.cpSync(buildInfo.stdlib, stdlibDest, {
    recursive: true,
    filter: (source) => {
      const normalized = source.replace(/\\/g, '/');
      if (normalized.includes('/test/') || normalized.endsWith('/test')) {
        return false;
      }
      if (normalized.includes('/__pycache__/')) {
        return false;
      }
      return true;
    },
  });
  dereferenceAbsoluteSymlinks(stdlibDest);

  // Remove distro-managed marker for the bundled private runtime
  const externallyManagedMarker = path.join(stdlibDest, 'EXTERNALLY-MANAGED');
  if (fs.existsSync(externallyManagedMarker)) {
    fs.rmSync(externallyManagedMarker, { force: true });
  }

  if (buildInfo.libdir && buildInfo.ldlibrary) {
    const libpython = path.join(buildInfo.libdir, buildInfo.ldlibrary);
    if (fs.existsSync(libpython)) {
      const libDest = path.join(pythonHome, 'lib');
      fs.mkdirSync(libDest, { recursive: true });
      fs.copyFileSync(libpython, path.join(libDest, path.basename(libpython)));
    }
  }

  if (process.platform === 'linux') {
    copyDynamicLibs(runtimePy, path.join(pythonHome, 'lib'));
  }

  // Install pocket-tts
  if (!runOptionalCommand(`${pythonCmd} -m pip --version`, process.env)) {
    runOptionalCommand(`${pythonCmd} -m ensurepip --upgrade`, process.env);
  }
  execSync(`${pythonCmd} -m pip install --target "${sitePackages}" "pocket-tts"`, {
    stdio: 'inherit',
    env: process.env,
  });

  fs.writeFileSync(manifestPath, JSON.stringify({
    layout: 'portable-python-home-v1',
    built_with: buildInfo.version,
    target: targetTriple,
    python_executable: path.relative(runtimeDir, runtimePy),
    site_packages: path.relative(runtimeDir, sitePackages),
  }, null, 2));
}

function ensurePocketTTSSidecar(targetTriple) {
  const bundleRuntime = process.env.POCKET_TTS_BUNDLE_RUNTIME === '1';
  if (process.env.SKIP_POCKET_TTS_SIDECAR === '1') {
    console.log('Skipping Pocket TTS sidecar (SKIP_POCKET_TTS_SIDECAR=1)');
    fs.mkdirSync(path.join(BIN_DIR, 'pocket-tts-runtime'), { recursive: true });
    return;
  }
  if (!bundleRuntime) {
    console.log('Skipping bundled Pocket TTS runtime (set POCKET_TTS_BUNDLE_RUNTIME=1 to enable).');
    fs.mkdirSync(path.join(BIN_DIR, 'pocket-tts-runtime'), { recursive: true });
    const sidecarPath = path.join(BIN_DIR, sidecarExecutableName('pocket-tts', targetTriple));
    if (!targetTriple.includes('windows')) {
      writePocketTTSLauncher(sidecarPath, targetTriple);
    }
    return;
  }

  const platform = process.platform;
  const ext = targetTriple.includes('windows') ? '.exe' : '';
  const sidecarName = sidecarExecutableName('pocket-tts', targetTriple);
  const sidecarPath = path.join(BIN_DIR, sidecarName);
  const { runtimeDir } = pocketTTSRuntimeLayout(targetTriple);

  let runtimeBuilt = hasPortablePocketTTSRuntime(targetTriple);
  if (runtimeBuilt) {
    console.log(`Pocket TTS portable runtime already exists: ${runtimeDir}`);
  }
  const pythonCmd = resolvePythonCommand();
  if (!runtimeBuilt && pythonCmd && platform !== 'win32') {
    console.log(`Building bundled Pocket TTS runtime at ${runtimeDir} ...`);
    buildPortablePocketTTSRuntime(targetTriple, pythonCmd);
    runtimeBuilt = true;
  } else if (!runtimeBuilt && platform !== 'win32') {
    console.warn('Python not found; falling back to wrapper sidecar when possible.');
  }

  if (platform === 'win32') {
    if (pythonCmd) {
      const venvPath = path.join(runtimeDir, '.venv');
      const py = path.join(venvPath, 'Scripts', 'python.exe');
      const pocketTtsBin = path.join(venvPath, 'Scripts', 'pocket-tts.exe');
      fs.mkdirSync(runtimeDir, { recursive: true });
      execSync(`${pythonCmd} -m venv "${venvPath}"`, { stdio: 'inherit' });
      execSync(`"${py}" -m pip install --upgrade pip`, { stdio: 'inherit' });
      execSync(`"${py}" -m pip install "pocket-tts"`, { stdio: 'inherit' });
      // On Windows, create a shim batch file
      const shimPath = path.join(BIN_DIR, `pocket-tts-${targetTriple}.cmd`);
      fs.writeFileSync(
        shimPath,
        `@echo off\r\nset SCRIPT_DIR=%~dp0\r\nset RUNTIME=%SCRIPT_DIR%pocket-tts-runtime\\${targetTriple}\\.venv\\Scripts\\pocket-tts.exe\r\nif exist "%RUNTIME%" (\r\n  "%RUNTIME%" %*\r\n) else (\r\n  pocket-tts %*\r\n)\r\n`
      );
      // Keep native CLI binary as the tauri sidecar target when available.
      if (fs.existsSync(pocketTtsBin)) {
        fs.copyFileSync(pocketTtsBin, sidecarPath);
        runtimeBuilt = true;
      } else {
        console.warn('Pocket TTS venv binary missing; CLI fallback on PATH will be required.');
      }
    }
  } else {
    writePocketTTSLauncher(sidecarPath, targetTriple);
  }

  // On unix-like systems we can always emit a wrapper so bundling still succeeds.
  if (!runtimeBuilt && !targetTriple.includes('windows')) {
    writePocketTTSLauncher(sidecarPath, targetTriple);
  }

  console.log(`Pocket TTS sidecar prepared: ${sidecarPath}`);
}

// ============ End Pocket TTS Support ============

function getPythonBuildInfo(pythonCmd) {
  const script = 'import json,platform,sys,sysconfig;print(json.dumps({"executable":sys.executable,"version":platform.python_version(),"major":sys.version_info.major,"minor":sys.version_info.minor,"stdlib":sysconfig.get_path("stdlib"),"libdir":sysconfig.get_config_var("LIBDIR"),"ldlibrary":sysconfig.get_config_var("LDLIBRARY")}))';
  const output = execSync(`${pythonCmd} -c '${script}'`, { encoding: 'utf8' }).trim();
  return JSON.parse(output);
}

function copyDynamicLibs(binaryPath, destLibDir) {
  if (process.platform !== 'linux') {
    return;
  }
  const output = execSync(`ldd "${binaryPath}"`, { encoding: 'utf8' });
  const libs = new Set();
  for (const line of output.split('\n')) {
    const m = line.match(/=>\s+(\/[^ ]+)\s+\(/);
    if (m && m[1]) {
      libs.add(m[1]);
      continue;
    }
    const direct = line.match(/^\s*(\/[^ ]+)\s+\(/);
    if (direct && direct[1]) {
      libs.add(direct[1]);
    }
  }
  fs.mkdirSync(destLibDir, { recursive: true });
  for (const lib of libs) {
    const base = path.basename(lib);
    fs.copyFileSync(lib, path.join(destLibDir, base));
  }
}

function runOptionalCommand(command, env) {
  try {
    execSync(command, { stdio: 'inherit', env });
    return true;
  } catch (error) {
    const message = error?.message || String(error);
    console.warn(`[NotebookLM runtime] Optional command failed: ${command}`);
    console.warn(message);
    return false;
  }
}

function buildPortableNotebookLMRuntime(targetTriple, pythonCmd) {
  const { runtimeDir, pythonHome, runtimePy, sitePackages, playwrightDir, manifestPath } = notebookLMRuntimeLayout(targetTriple);
  const buildInfo = getPythonBuildInfo(pythonCmd);
  const pyMajorMinor = `${buildInfo.major}.${buildInfo.minor}`;
  const stdlibDest = path.join(pythonHome, 'lib', `python${pyMajorMinor}`);
  const pyBinDir = process.platform === 'win32' ? pythonHome : path.join(pythonHome, 'bin');

  fs.rmSync(runtimeDir, { recursive: true, force: true });
  fs.mkdirSync(pyBinDir, { recursive: true });
  fs.mkdirSync(sitePackages, { recursive: true });
  fs.mkdirSync(playwrightDir, { recursive: true });

  fs.copyFileSync(buildInfo.executable, runtimePy);
  if (process.platform !== 'win32') {
    fs.chmodSync(runtimePy, 0o755);
    try {
      fs.symlinkSync('python3', path.join(pyBinDir, 'python'));
    } catch {
      // ignore if symlink cannot be created
    }
  }

  fs.cpSync(buildInfo.stdlib, stdlibDest, {
    recursive: true,
    filter: (source) => {
      const normalized = source.replace(/\\/g, '/');
      if (normalized.includes('/test/') || normalized.endsWith('/test')) {
        return false;
      }
      if (normalized.includes('/__pycache__/')) {
        return false;
      }
      return true;
    },
  });
  dereferenceAbsoluteSymlinks(stdlibDest);
  // Remove distro-managed marker for the bundled private runtime so pip can install packages.
  const externallyManagedMarker = path.join(stdlibDest, 'EXTERNALLY-MANAGED');
  if (fs.existsSync(externallyManagedMarker)) {
    fs.rmSync(externallyManagedMarker, { force: true });
  }

  if (buildInfo.libdir && buildInfo.ldlibrary) {
    const libpython = path.join(buildInfo.libdir, buildInfo.ldlibrary);
    if (fs.existsSync(libpython)) {
      const libDest = path.join(pythonHome, 'lib');
      fs.mkdirSync(libDest, { recursive: true });
      fs.copyFileSync(libpython, path.join(libDest, path.basename(libpython)));
    }
  }

  if (process.platform === 'linux') {
    copyDynamicLibs(runtimePy, path.join(pythonHome, 'lib'));
  }

  // Install dependencies with host Python to avoid distro-patched ensurepip restrictions
  // inside the copied private runtime (notably Ubuntu and Homebrew Python on CI).
  if (!runOptionalCommand(`${pythonCmd} -m pip --version`, process.env)) {
    runOptionalCommand(`${pythonCmd} -m ensurepip --upgrade`, process.env);
  }
  execSync(`${pythonCmd} -m pip install --target "${sitePackages}" "notebooklm-py[browser]"`, {
    stdio: 'inherit',
    env: process.env,
  });
  execSync(`${pythonCmd} -m playwright install chromium`, {
    stdio: 'inherit',
    env: {
      ...process.env,
      PYTHONPATH: sitePackages,
      PLAYWRIGHT_BROWSERS_PATH: playwrightDir,
    },
  });

  fs.writeFileSync(manifestPath, JSON.stringify({
    layout: 'portable-python-home-v1',
    built_with: buildInfo.version,
    target: targetTriple,
    python_executable: path.relative(runtimeDir, runtimePy),
    site_packages: path.relative(runtimeDir, sitePackages),
    playwright_dir: path.relative(runtimeDir, playwrightDir),
    required_paths: [
      path.relative(runtimeDir, runtimePy),
      path.relative(runtimeDir, sitePackages),
      path.join(path.relative(runtimeDir, sitePackages), 'notebooklm'),
    ],
  }, null, 2));
}

function ensureNotebookLMSidecar(targetTriple) {
  const bundleRuntime = process.env.NOTEBOOKLM_BUNDLE_RUNTIME === '1';
  if (process.env.SKIP_NOTEBOOKLM_SIDECAR === '1') {
    console.log('Skipping NotebookLM sidecar (SKIP_NOTEBOOKLM_SIDECAR=1)');
    fs.mkdirSync(path.join(BIN_DIR, 'notebooklm-runtime'), { recursive: true });
    return;
  }
  if (!bundleRuntime) {
    console.log('Skipping bundled NotebookLM runtime (set NOTEBOOKLM_BUNDLE_RUNTIME=1 to enable).');
    fs.mkdirSync(path.join(BIN_DIR, 'notebooklm-runtime'), { recursive: true });
    const sidecarPath = path.join(BIN_DIR, sidecarExecutableName('notebooklm', targetTriple));
    if (!targetTriple.includes('windows')) {
      writeNotebookLMLauncher(sidecarPath, targetTriple);
    }
    return;
  }

  const platform = process.platform;
  const ext = targetTriple.includes('windows') ? '.exe' : '';
  const sidecarName = sidecarExecutableName('notebooklm', targetTriple);
  const sidecarPath = path.join(BIN_DIR, sidecarName);
  const { runtimeDir } = notebookLMRuntimeLayout(targetTriple);

  let runtimeBuilt = hasPortableNotebookLMRuntime(targetTriple);
  if (runtimeBuilt) {
    console.log(`NotebookLM portable runtime already exists: ${runtimeDir}`);
  }
  const pythonCmd = resolvePythonCommand();
  if (!runtimeBuilt && pythonCmd && platform !== 'win32') {
    console.log(`Building bundled NotebookLM runtime at ${runtimeDir} ...`);
    buildPortableNotebookLMRuntime(targetTriple, pythonCmd);
    runtimeBuilt = true;
  } else if (!runtimeBuilt && platform !== 'win32') {
    console.warn('Python not found; falling back to wrapper sidecar when possible.');
  }

  if (platform === 'win32') {
    if (pythonCmd) {
      const venvPath = path.join(runtimeDir, '.venv');
      const py = path.join(venvPath, 'Scripts', 'python.exe');
      const notebooklmBin = path.join(venvPath, 'Scripts', 'notebooklm.exe');
      fs.mkdirSync(runtimeDir, { recursive: true });
      execSync(`${pythonCmd} -m venv "${venvPath}"`, { stdio: 'inherit' });
      execSync(`"${py}" -m pip install --upgrade pip`, { stdio: 'inherit' });
      execSync(`"${py}" -m pip install "notebooklm-py[browser]"`, { stdio: 'inherit' });
      execSync(`"${py}" -m playwright install chromium`, {
        stdio: 'inherit',
        env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' },
      });
      // On Windows, create a shim batch and copy as sidecar target name without extension conflicts.
      const shimPath = path.join(BIN_DIR, `notebooklm-${targetTriple}.cmd`);
      fs.writeFileSync(
        shimPath,
        `@echo off\r\nset SCRIPT_DIR=%~dp0\r\nset RUNTIME=%SCRIPT_DIR%notebooklm-runtime\\${targetTriple}\\.venv\\Scripts\\notebooklm.exe\r\nif exist "%RUNTIME%" (\r\n  "%RUNTIME%" %*\r\n) else (\r\n  notebooklm %*\r\n)\r\n`
      );
      // Keep native CLI binary as the tauri sidecar target when available.
      if (fs.existsSync(notebooklmBin)) {
        fs.copyFileSync(notebooklmBin, sidecarPath);
        runtimeBuilt = true;
      } else {
        console.warn('NotebookLM venv binary missing; CLI fallback on PATH will be required.');
      }
    }
  } else {
    writeNotebookLMLauncher(sidecarPath, targetTriple);
  }

  // On unix-like systems we can always emit a wrapper so bundling still succeeds.
  if (!runtimeBuilt && !targetTriple.includes('windows')) {
    writeNotebookLMLauncher(sidecarPath, targetTriple);
  }

  console.log(`NotebookLM sidecar prepared: ${sidecarPath}`);
}

// Helper to recursively find and copy shared libraries
function findAndCopyLibs(dir, destDir, ext) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findAndCopyLibs(fullPath, destDir, ext);
    } else if (entry.name.endsWith(ext)) {
      console.log(`Copying shared library: ${entry.name}`);
      fs.copyFileSync(fullPath, path.join(destDir, entry.name));
    }
  }
}

async function main() {
  const targetTriple = getTargetTriple();
  console.log(`Downloading sidecars for target: ${targetTriple}`);
  const mobileTarget = isMobileTargetTriple(targetTriple);

  if (mobileTarget) {
    console.log(`Mobile target detected (${targetTriple}); skipping desktop sidecar provisioning.`);
    return;
  }

  // FFmpeg URLs (using static builds from a reliable source like mwader/static-ffmpeg or similar)
  // For simplicity/reliability in this script, we'll use a placeholder or a known good release.
  // Note: For a production app, you should host these yourself or use a very stable release.
  // We will use: https://github.com/eugeneware/ffmpeg-static for node, but here we need standalone binaries.
  // Let's use https://github.com/ffbinaries/ffbinaries-prebuilt (often used) OR manually constructed URLs.
  
  // Actually, standard practice for Tauri is to download from a place you control.
  // Since I don't have a bucket, I will use:
  // - FFmpeg: https://github.com/BtbN/FFmpeg-Builds (Linux/Win), https://evermeet.cx/ffmpeg/ (Mac) - complex to script perfectly.
  //
  // ALTERNATIVE: Use `ffmpeg-static` via npm but extract the binary? No, we need it in src-tauri/bin.
  
  // Let's use a simpler source for now, e.g., standard releases.
  // Linux: https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz (requires extraction)
  
  // For the sake of this task, I will mock the "download" if files don't exist, OR 
  // actually, to make it work in CI, I must use real URLs.
  //
  // Whisper.cpp:
  // https://github.com/ggerganov/whisper.cpp/releases/latest
  // They provide `whisper-bin-x64.zip` etc.
  
  // Strategy:
  // 1. Define URLs for each platform.
  // 2. Download and extract (if zip/tar).
  // 3. Rename to <name>-<target-triple><.exe>.

  // Since extraction is complex in pure node without deps (need unzip/tar), 
  // I will assume the CI environment has `curl`, `tar`, `unzip`.
  // I will use `execSync` to run shell commands which is easier for extraction.

  const platform = process.platform;
  const ext = platform === 'win32' ? '.exe' : '';
  const ffmpegName = `ffmpeg-${targetTriple}${ext}`;
  const whisperName = `whisper-${targetTriple}${ext}`;
  const notebooklmName = sidecarExecutableName('notebooklm', targetTriple);
  const ffmpegPath = path.join(BIN_DIR, ffmpegName);
  const whisperPath = path.join(BIN_DIR, whisperName);
  const notebooklmPath = path.join(BIN_DIR, notebooklmName);
  const sherpaName = `sherpa-onnx-${targetTriple}`;
  const sherpaPath = path.join(BIN_DIR, sherpaName);
  const notebooklmSidecarPresent = fs.existsSync(notebooklmPath);
  const notebooklmSkipped = process.env.SKIP_NOTEBOOKLM_SIDECAR === '1';
  const notebooklmRequired = !notebooklmSkipped
    && process.env.NOTEBOOKLM_BUNDLE_RUNTIME === '1';
  // Windows non-bundled builds can run without a NotebookLM sidecar placeholder.
  const notebooklmMustExist = !notebooklmSkipped
    && (!targetTriple.includes('windows') || notebooklmRequired);
  const notebooklmPortableReady = hasPortableNotebookLMRuntime(targetTriple) && notebooklmSidecarPresent;
  const notebooklmRuntimeReady = targetTriple.includes('windows')
    ? notebooklmSidecarPresent
    : notebooklmPortableReady;

  // If both sidecars are already present (as in release/source builds), skip download/build.
  if (
    fs.existsSync(ffmpegPath)
    && fs.existsSync(whisperPath)
    && fs.existsSync(sherpaPath)
    && (!notebooklmMustExist || notebooklmSidecarPresent)
    && (!notebooklmRequired || notebooklmRuntimeReady)
  ) {
    console.log(`Sidecars already exist for ${targetTriple}, skipping download/build.`);
    try {
      fs.chmodSync(ffmpegPath, 0o755);
      fs.chmodSync(whisperPath, 0o755);
      if (fs.existsSync(sherpaPath)) {
        fs.chmodSync(sherpaPath, 0o755);
      }
      if (fs.existsSync(notebooklmPath)) {
        fs.chmodSync(notebooklmPath, 0o755);
      }
    } catch {
      // ignore (e.g., Windows)
    }
    console.log('Sidecars ready:', fs.readdirSync(BIN_DIR));
    return;
  }

  if (platform === 'linux') {
    // Linux FFmpeg (vestigial: ffmpeg isn't a Tauri externalBin — it's resolved
    // from PATH / deb `depends` at runtime — but we still stage a binary for
    // completeness). Pick the static build matching the host arch so we never
    // produce a wrong-arch ffmpeg (e.g. an x86_64 binary labeled
    // ffmpeg-aarch64-unknown-linux-gnu on the arm64 runner).
    const isArm64 = targetTriple.startsWith('aarch64');
    console.log('Downloading FFmpeg (Linux)...');
    const ffmpegArchive = `ffmpeg-linux-${isArm64 ? 'arm64' : 'x64'}.tar.xz`;
    const ffmpegUrls = isArm64
      ? ['https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz']
      : [
          'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
          'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz',
        ];
    downloadFile(ffmpegUrls, ffmpegArchive);
    execSync(`tar -xf ${shellQuote(ffmpegArchive)}`);
    const extractedFolders = fs.readdirSync('.')
      .filter(f => f.startsWith('ffmpeg-') && fs.statSync(f).isDirectory());
    const ffmpegBinary = extractedFolders
      .map(folder => findFileRecursive(folder, 'ffmpeg'))
      .find(Boolean);

    if (!ffmpegBinary) {
      throw new Error('Downloaded FFmpeg archive did not contain an ffmpeg binary.');
    }

    fs.copyFileSync(ffmpegBinary, path.join(BIN_DIR, ffmpegName));
    fs.rmSync(ffmpegArchive, { force: true });
    for (const folder of extractedFolders) {
      fs.rmSync(folder, { recursive: true, force: true });
    }

    // Linux Whisper (building from source using CMake)
    console.log('Building Whisper (Linux)...');
    if (!fs.existsSync(path.join(BIN_DIR, whisperName))) {
        console.log('Building Whisper.cpp from source...');
        ensureWhisperSource();
        
        // Check for CUDA
        let cudaFlag = '';
        try {
            execSync('command -v nvcc');
            console.log('NVIDIA GPU detected (nvcc found), enabling CUDA support...');
            cudaFlag = '-DGGML_CUDA=1';
        } catch {
            console.log('No NVIDIA GPU detected or nvcc not found, building for CPU...');
        }
        
        // Build with static linking to avoid shared library issues
        // -DBUILD_SHARED_LIBS=OFF creates a standalone binary
        execSync(`cd whisper.cpp && cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_BLAS=OFF ${cudaFlag}`);
        execSync('cd whisper.cpp && cmake --build build --config Release --parallel');
        fs.copyFileSync('whisper.cpp/build/bin/whisper-cli', path.join(BIN_DIR, whisperName));
        
        // Also copy any .so files if they exist (fallback for systems that need them)
        // Search recursively in build directory for shared libraries
        findAndCopyLibs('whisper.cpp/build', BIN_DIR, '.so');
        findAndCopyLibs('whisper.cpp/build', BIN_DIR, '.so.1');
        
        // Try to use patchelf to set RPATH to look for libs in the same directory
        // This allows the binary to find libwhisper.so.1 without LD_LIBRARY_PATH
        try {
            const whisperBinPath = path.join(BIN_DIR, whisperName);
            console.log('Attempting to set RPATH for whisper binary...');
            execSync(`patchelf --set-rpath '$ORIGIN' ${whisperBinPath}`, { stdio: 'ignore' });
            console.log('RPATH set successfully.');
        } catch {
            console.log('Note: patchelf not available, binary may need LD_LIBRARY_PATH set');
        }
        // execSync('rm -rf whisper.cpp');
    }

  } else if (platform === 'darwin') {
    // Mac FFmpeg
    if (!fs.existsSync(ffmpegPath)) {
      console.log('Downloading FFmpeg (Mac)...');
      let ffmpegInstalled = false;

      try {
        execSync('curl -fL --retry 3 --retry-delay 2 https://evermeet.cx/ffmpeg/getrelease/zip -o ffmpeg.zip', { stdio: 'inherit' });
        // Validate archive before unzip (prevents HTML/error pages being treated as zip files)
        execSync('unzip -t ffmpeg.zip', { stdio: 'inherit' });
        execSync('unzip -o ffmpeg.zip', { stdio: 'inherit' });
        fs.copyFileSync('ffmpeg', ffmpegPath);
        ffmpegInstalled = true;
      } catch {
        console.warn('Primary FFmpeg download failed; trying system ffmpeg fallback...');
      } finally {
        try { fs.unlinkSync('ffmpeg.zip'); } catch { /* best-effort cleanup */ }
        try { fs.unlinkSync('ffmpeg'); } catch { /* best-effort cleanup */ }
      }

      if (!ffmpegInstalled) {
        if (!commandExists('ffmpeg')) {
          throw new Error('Failed to download FFmpeg for macOS and no system ffmpeg found in PATH.');
        }
        const systemFfmpegPath = execSync('command -v ffmpeg').toString().trim();
        fs.copyFileSync(systemFfmpegPath, ffmpegPath);
      }
    }

    // Mac Whisper (Build from source using CMake)
    if (!fs.existsSync(whisperPath)) {
        console.log('Building Whisper.cpp from source...');
        ensureWhisperSource();
        
        const isAppleSilicon = process.arch === 'arm64';
        let gpuFlags = '';
        
        if (isAppleSilicon) {
            // Apple Silicon - use Metal Performance Shaders
            console.log('Apple Silicon detected, enabling Metal GPU support...');
            gpuFlags = '-DGGML_METAL=1 -DGGML_METAL_EMBED_LIBRARY=ON';
        } else {
            // Intel Mac - check for AMD GPU (limited support)
            console.log('Intel Mac detected, building for CPU...');
        }
        
        // Build with static linking to avoid shared library issues
        execSync(`cd whisper.cpp && cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_BLAS=OFF ${gpuFlags}`);
        execSync('cd whisper.cpp && cmake --build build --config Release --parallel');
        fs.copyFileSync('whisper.cpp/build/bin/whisper-cli', whisperPath);
        
        // Also copy any .dylib files if they exist (macOS shared libraries)
        // Search recursively in build directory for shared libraries
        findAndCopyLibs('whisper.cpp/build', BIN_DIR, '.dylib');
        // execSync('rm -rf whisper.cpp');
    }

  } else if (platform === 'win32') {
    // Windows FFmpeg
    console.log('Downloading FFmpeg (Windows)...');
    // Using gyan.dev release
    const ffmpegUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
    // Powershell download/extract is implied if running in standard win environment, 
    // but here we are in node.
    // We can use curl if available (Win 10+ has it) or the node helper above.
    // For simplicity in this script, let's assume `curl` and `tar` (git bash) might NOT be present.
    // But GitHub Actions Windows runner HAS `curl`, `7z`.
    
    execSync(`curl -L ${ffmpegUrl} -o ffmpeg.zip`);
    execSync('7z x ffmpeg.zip');
    // Move from extracted folder
    const folder = fs.readdirSync('.').find(f => f.startsWith('ffmpeg-') && fs.statSync(f).isDirectory());
    fs.copyFileSync(path.join(folder, 'bin', 'ffmpeg.exe'), path.join(BIN_DIR, ffmpegName));
    execSync(`rm -rf ffmpeg.zip ${folder}`);

    // Windows Whisper (build from source via CMake)
    if (!fs.existsSync(path.join(BIN_DIR, whisperName))) {
      console.log('Building Whisper.cpp from source...');
      ensureWhisperSource();

      // Build with static linking
      execSync('cd whisper.cpp && cmake -B build -DBUILD_SHARED_LIBS=OFF -DGGML_BLAS=OFF');
      execSync('cd whisper.cpp && cmake --build build --config Release --parallel');

      const candidates = [
        'whisper.cpp/build/bin/Release/whisper-cli.exe',
        'whisper.cpp/build/bin/whisper-cli.exe',
      ];
      const binaryPath = candidates.find((candidate) => fs.existsSync(candidate));
      if (!binaryPath) {
        throw new Error('Failed to locate whisper-cli.exe after build');
      }
      fs.copyFileSync(binaryPath, path.join(BIN_DIR, whisperName));
      
      // Also copy any .dll files if they exist (Windows shared libraries)
      // Search recursively in build directory for shared libraries
      findAndCopyLibs('whisper.cpp/build', BIN_DIR, '.dll');
    }
  }

  // Provision the sherpa-onnx sidecar (used by Parakeet local transcription).
  // Platform-agnostic: downloads the right prebuilt tarball for the target triple.
  ensureSherpaSidecar(targetTriple);

  // Build bundled notebooklm sidecar/runtime used by NotebookLM integration.
  if (notebooklmMustExist && (notebooklmRequired || !fs.existsSync(notebooklmPath))) {
    ensureNotebookLMSidecar(targetTriple);
    if (!fs.existsSync(notebooklmPath)) {
      throw new Error(
        `NotebookLM sidecar missing for ${targetTriple} (${notebooklmName}). ` +
        `Ensure python3 is installed to build bundled runtime or wrapper sidecar, or pre-provide ${notebooklmPath}.`
      );
    }
  } else if (notebooklmSkipped) {
    console.log(`Skipping NotebookLM sidecar (SKIP_NOTEBOOKLM_SIDECAR=1)`);
  } else {
    console.log(`NotebookLM runtime bundling disabled for target ${targetTriple} (lazy first-run install will be used).`);
  }

  // Build bundled Pocket TTS sidecar/runtime
  const pocketTtsName = sidecarExecutableName('pocket-tts', targetTriple);
  const pocketTtsPath = path.join(BIN_DIR, pocketTtsName);
  const pocketTtsSkipped = process.env.SKIP_POCKET_TTS_SIDECAR === '1';
  const pocketTtsRequired = !pocketTtsSkipped && process.env.POCKET_TTS_BUNDLE_RUNTIME === '1';

  if (!pocketTtsSkipped) {
    ensurePocketTTSSidecar(targetTriple);
    // For non-Windows, the wrapper script is always created
    // For Windows, we need the actual binary
    if (!targetTriple.includes('windows') || pocketTtsRequired) {
      if (!fs.existsSync(pocketTtsPath)) {
        console.warn(`Pocket TTS sidecar not created for ${targetTriple} - will fall back to system pocket-tts if available.`);
      }
    }
  }

  // Make executable
  try {
    fs.chmodSync(ffmpegPath, 0o755);
    fs.chmodSync(whisperPath, 0o755);
    if (fs.existsSync(sherpaPath)) {
      fs.chmodSync(sherpaPath, 0o755);
    }
  } catch {
    // Windows might fail chmod, ignore
  }

  console.log('Sidecars ready:', fs.readdirSync(BIN_DIR));
  
  // GPU Support Summary
  console.log('\n=== GPU Acceleration Status ===');
  if (platform === 'darwin') {
    if (process.arch === 'arm64') {
      console.log('✅ Metal GPU: ENABLED (Apple Silicon)');
    } else {
      console.log('⚠️  GPU: Not available (Intel Mac - CPU only)');
    }
  } else if (platform === 'linux') {
    try {
      execSync('command -v nvcc', { stdio: 'ignore' });
      console.log('✅ CUDA GPU: ENABLED (NVIDIA)');
    } catch {
      console.log('⚠️  GPU: Not detected - Using CPU (Install NVIDIA drivers for CUDA support)');
    }
  } else if (platform === 'win32') {
    console.log('⚠️  GPU: Windows builds are CPU-only (GPU support pending)');
  }
  console.log('================================\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
