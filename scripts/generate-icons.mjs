/**
 * Generate web and extension icons from the canonical Tauri app icon.
 * Uses ImageMagick (convert) which is available on this system.
 */
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');
const browserExtensionIconsDir = join(__dirname, '..', 'browser_extension', 'icons');
const source = join(__dirname, '..', 'src-tauri', 'icons', 'icon.png');

const pwaSizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const extensionSizes = [16, 32, 48, 128];

function resizeIcon(output, size) {
  const result = spawnSync('magick', [source, '-resize', `${size}x${size}`, output], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`ImageMagick failed for ${output}`);
  }
}

for (const size of pwaSizes) {
  const out = join(iconsDir, `icon-${size}x${size}.png`);
  resizeIcon(out, size);
  console.log(`Created icon-${size}x${size}.png`);
}

for (const size of extensionSizes) {
  const out = join(browserExtensionIconsDir, `icon${size}.png`);
  resizeIcon(out, size);
  console.log(`Created browser_extension/icons/icon${size}.png`);
}

const appleTouchIcon = join(__dirname, '..', 'public', 'apple-touch-icon.png');
resizeIcon(appleTouchIcon, 180);
console.log('Created apple-touch-icon.png');

const badge = join(iconsDir, 'badge-72x72.png');
resizeIcon(badge, 72);
console.log('Created badge-72x72.png');

console.log('Done!');
