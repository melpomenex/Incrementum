import fs from 'fs';
import path from 'path';
import https from 'https';
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

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve());
      });
    });

    request.on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

function ensureWhisperSource() {
  if (fs.existsSync(path.join('whisper.cpp', 'CMakeLists.txt'))) {
    return;
  }

  try {
    execSync('git submodule update --init --recursive whisper.cpp');
  } catch (e) {
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
        } catch (e) {
            console.log('No NVIDIA GPU detected or nvcc not found, building for CPU...');
        }
        
        execSync(`cd whisper.cpp && cmake -B build -DCMAKE_BUILD_TYPE=Release ${cudaFlag}`);
        execSync('cd whisper.cpp && cmake --build build --config Release --parallel');
        fs.copyFileSync('whisper.cpp/build/bin/whisper-cli', path.join(BIN_DIR, whisperName));
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
      } catch (e) {
        console.warn('Primary FFmpeg download failed; trying system ffmpeg fallback...');
      } finally {
        try { fs.unlinkSync('ffmpeg.zip'); } catch {}
        try { fs.unlinkSync('ffmpeg'); } catch {}
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
        
        // Check for CUDA
        let cudaFlag = '';
        try {
            execSync('command -v nvcc');
            console.log('NVIDIA GPU detected (nvcc found), enabling CUDA support...');
            cudaFlag = '-DGGML_CUDA=1';
        } catch (e) {
            console.log('No NVIDIA GPU detected or nvcc not found, building for CPU...');
        }
        
        execSync(`cd whisper.cpp && cmake -B build -DCMAKE_BUILD_TYPE=Release ${cudaFlag}`);
        execSync('cd whisper.cpp && cmake --build build --config Release --parallel');
        fs.copyFileSync('whisper.cpp/build/bin/whisper-cli', whisperPath);
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

      execSync('cd whisper.cpp && cmake -B build');
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
    }
  }

  // Make executable
  try {
    fs.chmodSync(ffmpegPath, 0o755);
    fs.chmodSync(whisperPath, 0o755);
  } catch (e) {
    // Windows might fail chmod, ignore
  }

  console.log('Sidecars ready:', fs.readdirSync(BIN_DIR));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
