/**
 * Generate notification sound files using ffmpeg.
 * Creates WAV files from synthesized tones, then converts to MP3.
 */
import { execSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'sounds');
mkdirSync(outDir, { recursive: true });

const sounds = [
  {
    name: 'bell',
    // Two harmonics: 830Hz + 1660Hz with exponential decay over 1.5s
    ffmpeg: `-f lavfi -i "sine=frequency=830:duration=1.5" -f lavfi -i "sine=frequency=1660:duration=1.5" -filter_complex "[0]volume=0.4[a];[1]volume=0.2[b];[a][b]amix=inputs=2:duration=longest,afade=t=out:st=0.2:d=1.3"`,
  },
  {
    name: 'chime',
    // Three ascending tones: C5(523), E5(659), G5(784) each 0.2s with 0.15s gap
    ffmpeg: `-f lavfi -i "sine=frequency=523:duration=0.25" -f lavfi -i "sine=frequency=659:duration=0.25" -f lavfi -i "sine=frequency=784:duration=0.35" -filter_complex "[0]adelay=0|0,volume=0.3[a];[1]adelay=350|350,volume=0.3[b];[2]adelay=700|700,volume=0.3[c];[a][b][c]amix=inputs=3:duration=longest,afade=t=out:st=0.7:d=0.5"`,
  },
  {
    name: 'ding',
    // Single clean 1200Hz tone with fast decay
    ffmpeg: `-f lavfi -i "sine=frequency=1200:duration=0.5" -af "afade=t=in:st=0:d=0.01,afade=t=out:st=0.05:d=0.45,volume=0.35"`,
  },
  {
    name: 'complete',
    // Rising two-tone: 440Hz -> 880Hz (sounds like "done!")
    ffmpeg: `-f lavfi -i "sine=frequency=440:duration=0.3" -f lavfi -i "sine=frequency=880:duration=0.5" -filter_complex "[0]volume=0.3[a];[1]adelay=250|250,volume=0.35[b];[a][b]amix=inputs=2:duration=longest,afade=t=out:st=0.4:d=0.5"`,
  },
];

for (const sound of sounds) {
  const outFile = join(outDir, `${sound.name}.mp3`);
  const cmd = `ffmpeg -y ${sound.ffmpeg} -c:a libmp3lame -q:a 6 "${outFile}" 2>/dev/null`;
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log(`Created: ${sound.name}.mp3`);
  } catch (e) {
    console.error(`Failed to create ${sound.name}.mp3:`, e.message);
  }
}

console.log('Done! Sound files are in public/sounds/');
