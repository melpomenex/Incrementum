import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BIN_DIR = path.join(__dirname, '../src-tauri/bin');

if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

function getTargetTriple() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    return 'x86_64-pc-windows-msvc';
  } else if (platform === 'darwin') {
    return arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
  } else if (platform === 'linux') {
    return 'x86_64-unknown-linux-gnu';
  }
  
  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

function ensureWhisperSource() {
  if (fs.existsSync(path.join('whisper.cpp', 'CMakeLists.txt'))) {
    return;
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

function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
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
  const ffmpegPath = path.join(BIN_DIR, ffmpegName);
  const whisperPath = path.join(BIN_DIR, whisperName);

  // If both sidecars are already present (as in release/source builds), skip download/build.
  if (fs.existsSync(ffmpegPath) && fs.existsSync(whisperPath)) {
    console.log(`Sidecars already exist for ${targetTriple}, skipping download/build.`);
    try {
      fs.chmodSync(ffmpegPath, 0o755);
      fs.chmodSync(whisperPath, 0o755);
    } catch {
      // ignore (e.g., Windows)
    }
    console.log('Sidecars ready:', fs.readdirSync(BIN_DIR));
    return;
  }

  if (platform === 'linux') {
    // Linux FFmpeg
    console.log('Downloading FFmpeg (Linux)...');
    execSync('curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ffmpeg.tar.xz');
    execSync('tar -xf ffmpeg.tar.xz');
    // Find the binary in the extracted folder (it has a version name)
    const folder = fs.readdirSync('.').find(f => f.startsWith('ffmpeg-') && fs.statSync(f).isDirectory());
    fs.copyFileSync(path.join(folder, 'ffmpeg'), path.join(BIN_DIR, ffmpegName));
    execSync('rm -rf ffmpeg.tar.xz ' + folder);

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
        execSync(`cd whisper.cpp && cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF ${cudaFlag}`);
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
        execSync(`cd whisper.cpp && cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF ${gpuFlags}`);
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
      execSync('cd whisper.cpp && cmake -B build -DBUILD_SHARED_LIBS=OFF');
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

  // Make executable
  try {
    fs.chmodSync(ffmpegPath, 0o755);
    fs.chmodSync(whisperPath, 0o755);
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
