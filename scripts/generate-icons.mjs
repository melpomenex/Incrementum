/**
 * Generate PWA icon PNGs from the SVG source.
 * Uses ImageMagick (convert) which is available on this system.
 */
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');
const svg = join(iconsDir, 'icon.svg');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  const out = join(iconsDir, `icon-${size}x${size}.png`);
  execSync(`convert -background none -density 384 -resize ${size}x${size} "${svg}" "${out}"`, { stdio: 'pipe' });
  console.log(`Created icon-${size}x${size}.png`);
}

// Generate badge icon (simplified, smaller)
const badge = join(iconsDir, 'badge-72x72.png');
execSync(`convert -background none -density 384 -resize 72x72 "${svg}" "${badge}"`, { stdio: 'pipe' });
console.log('Created badge-72x72.png');

console.log('Done!');
