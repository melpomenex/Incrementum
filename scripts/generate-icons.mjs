/**
 * Generate web and extension icons from the canonical sprout SVG.
 * Uses ImageMagick, which is available on this system.
 */
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');
const browserExtensionIconsDir = join(__dirname, '..', 'browser_extension', 'icons');
const source = join(__dirname, '..', 'src-tauri', 'icons', 'sprout.svg');

const pwaSizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const extensionSizes = [16, 32, 48, 128];
const sproutPrefix = 'sprout';

function resizeIcon(output, size) {
  const result = spawnSync(
    'magick',
    [
      source,
      '-background',
      'none',
      '-resize',
      `${size}x${size}`,
      '-gravity',
      'center',
      '-extent',
      `${size}x${size}`,
      output,
    ],
    {
      stdio: 'inherit',
    }
  );
  if (result.status !== 0) {
    throw new Error(`ImageMagick failed for ${output}`);
  }
}

function resizeMaskableIcon(output, size) {
  const padded = Math.round(size * 0.8);
  const result = spawnSync(
    'magick',
    [
      source,
      '-background',
      'none',
      '-resize',
      `${padded}x${padded}`,
      '-gravity',
      'center',
      '-extent',
      `${size}x${size}`,
      output,
    ],
    {
      stdio: 'inherit',
    }
  );
  if (result.status !== 0) {
    throw new Error(`ImageMagick failed for ${output}`);
  }
}

function writeIconPair(size) {
  const anyOut = join(iconsDir, `${sproutPrefix}-${size}x${size}.png`);
  resizeIcon(anyOut, size);
  console.log(`Created ${sproutPrefix}-${size}x${size}.png`);

  if (size === 192 || size === 512) {
    const maskableOut = join(iconsDir, `${sproutPrefix}-maskable-${size}x${size}.png`);
    resizeMaskableIcon(maskableOut, size);
    console.log(`Created ${sproutPrefix}-maskable-${size}x${size}.png`);
  }

  const legacyOut = join(iconsDir, `icon-${size}x${size}.png`);
  resizeIcon(legacyOut, size);
  console.log(`Updated icon-${size}x${size}.png`);
}

for (const size of pwaSizes) {
  writeIconPair(size);
}

for (const size of extensionSizes) {
  const out = join(browserExtensionIconsDir, `icon${size}.png`);
  resizeIcon(out, size);
  console.log(`Created browser_extension/icons/icon${size}.png`);
}

const appleTouchIcon = join(__dirname, '..', 'public', 'apple-touch-icon.png');
resizeIcon(appleTouchIcon, 180);
console.log('Created apple-touch-icon.png');

const publicIcon = join(__dirname, '..', 'public', 'icon.png');
resizeIcon(publicIcon, 512);
console.log('Updated public/icon.png');

const badge = join(iconsDir, 'badge-72x72.png');
resizeIcon(badge, 72);
console.log('Created badge-72x72.png');

console.log('Done!');
