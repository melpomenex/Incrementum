/**
 * Copy the curated tactile sound set into public/sounds/.
 */
import { copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const outDir = join(__dirname, '..', 'public', 'sounds');
mkdirSync(outDir, { recursive: true });

const sounds = [
  // Tighter feedback set for direct manipulation and review actions.
  { outName: 'success.mp3', source: 'sounds/curated/correct_01.mp3' },
  { outName: 'error.mp3', source: 'sounds/curated/wrong_02.mp3' },
  { outName: 'warning.mp3', source: 'sounds/curated/question_01.mp3' },
  { outName: 'ui-complete.mp3', source: 'sounds/curated/reveal_01.mp3' },
  { outName: 'click.mp3', source: 'sounds/curated/click_02.mp3' },
  { outName: 'delete.mp3', source: 'sounds/interface-sounds-mp3/drop_001.mp3' },
  { outName: 'review-complete.mp3', source: 'sounds/curated/correct_04.mp3' },
  { outName: 'streak.mp3', source: 'sounds/curated/notification_02.mp3' },
  { outName: 'milestone.mp3', source: 'sounds/curated/notification_03.mp3' },

  // Notification variants: all short, clean, and non-musical.
  { outName: 'glass.mp3', source: 'sounds/curated/notification_02.mp3' },
  { outName: 'bloom.mp3', source: 'sounds/curated/notification_03.mp3' },
  { outName: 'pulse.mp3', source: 'sounds/curated/timer_tick_01.mp3' },
  { outName: 'ascend.mp3', source: 'sounds/curated/correct_02.mp3' },
  { outName: 'softbell.mp3', source: 'sounds/curated/notification_01.mp3' },
  { outName: 'sonar.mp3', source: 'sounds/curated/question_01.mp3' },
];

for (const sound of sounds) {
  const inFile = join(rootDir, sound.source);
  const outFile = join(outDir, sound.outName);
  copyFileSync(inFile, outFile);
  console.log(`Copied: ${sound.outName} <= ${sound.source}`);
}

console.log('Done! Tactile sound files are in public/sounds/');
