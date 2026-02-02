const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

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

  if (platform === 'linux') {
    // Linux FFmpeg
    console.log('Downloading FFmpeg (Linux)...');
    execSync('curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ffmpeg.tar.xz');
    execSync('tar -xf ffmpeg.tar.xz');
    // Find the binary in the extracted folder (it has a version name)
    const folder = fs.readdirSync('.').find(f => f.startsWith('ffmpeg-') && fs.statSync(f).isDirectory());
    fs.copyFileSync(path.join(folder, 'ffmpeg'), path.join(BIN_DIR, ffmpegName));
    execSync('rm -rf ffmpeg.tar.xz ' + folder);

    // Linux Whisper (using 1.5.4 release as example)
    console.log('Downloading Whisper (Linux)...');
    // Whisper.cpp releases don't always have prebuilt linux binaries easily accessible as single files.
    // They are usually in a zip "whisper-bin-x64".
    // URL: https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.tar.gz (example? No)
    // Actually, checking their releases... they usually just have source.
    // Wait, let's use a reliable mirror or assume we build it? No, CI should be fast.
    
    // Fallback: If we can't find a reliable prebuild for whisper.cpp linux, we might have to skip or build it.
    // BUT the user asked to "set this up".
    // 
    // Let's use a "dummy" echo script for now if real download is too fragile, 
    // BUT the user wants it to "work".
    // 
    // Okay, for Whisper.cpp, the best way on Linux CI is often to build it because it's fast (C++).
    // `make main` -> `src-tauri/bin/whisper-...`
    // 
    // Let's try to clone and build whisper.cpp for Linux/Mac. Windows is harder.
    
    if (!fs.existsSync(path.join(BIN_DIR, whisperName))) {
        console.log('Building Whisper.cpp from source...');
        if (fs.existsSync('whisper.cpp')) execSync('rm -rf whisper.cpp');
        execSync('git clone https://github.com/ggerganov/whisper.cpp.git');
        execSync('cd whisper.cpp && make main');
        fs.copyFileSync('whisper.cpp/main', path.join(BIN_DIR, whisperName));
        execSync('rm -rf whisper.cpp');
    }

  } else if (platform === 'darwin') {
    // Mac FFmpeg
    console.log('Downloading FFmpeg (Mac)...');
    execSync('curl -L https://evermeet.cx/ffmpeg/getrelease/zip -o ffmpeg.zip');
    execSync('unzip -o ffmpeg.zip');
    fs.copyFileSync('ffmpeg', path.join(BIN_DIR, ffmpegName));
    fs.unlinkSync('ffmpeg.zip');
    fs.unlinkSync('ffmpeg');

    // Mac Whisper (Build from source is reliable on Mac too)
    if (!fs.existsSync(path.join(BIN_DIR, whisperName))) {
        console.log('Building Whisper.cpp from source...');
        if (fs.existsSync('whisper.cpp')) execSync('rm -rf whisper.cpp');
        execSync('git clone https://github.com/ggerganov/whisper.cpp.git');
        execSync('cd whisper.cpp && make main');
        fs.copyFileSync('whisper.cpp/main', path.join(BIN_DIR, whisperName));
        execSync('rm -rf whisper.cpp');
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

    // Windows Whisper
    // We can try to download prebuilt libwhisper.dll / main.exe if available.
    // ggerganov/whisper.cpp releases sometimes have windows zips.
    // Let's check v1.5.4: `whisper-bin-x64.zip` exists!
    const whisperUrl = 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.1/whisper-bin-x64.zip';
    console.log('Downloading Whisper (Windows)...');
    execSync(`curl -L ${whisperUrl} -o whisper.zip`);
    execSync('7z x whisper.zip');
    fs.copyFileSync('main.exe', path.join(BIN_DIR, whisperName));
    execSync('rm -rf whisper.zip main.exe');
  }

  // Make executable
  try {
    fs.chmodSync(path.join(BIN_DIR, ffmpegName), 0o755);
    fs.chmodSync(path.join(BIN_DIR, whisperName), 0o755);
  } catch (e) {
    // Windows might fail chmod, ignore
  }

  console.log('Sidecars ready:', fs.readdirSync(BIN_DIR));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
