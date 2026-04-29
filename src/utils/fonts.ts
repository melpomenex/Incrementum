/**
 * Dynamic Google Font loader.
 *
 * Injects a <link> for the chosen Google Font so the browser can render it.
 * System fonts (system-ui, serif, sans-serif, monospace) are skipped — they
 * are already available locally and don't need a network fetch.
 */

const SYSTEM_FONTS = new Set(["system-ui", "serif", "sans-serif", "monospace"]);
const loadedFonts = new Set<string>();

/**
 * Ensure the given Google Font family is loaded.
 * Safe to call multiple times — each font is fetched at most once.
 */
export function loadGoogleFont(family: string): void {
  if (SYSTEM_FONTS.has(family) || loadedFonts.has(family)) return;

  const encoded = family.replace(/ /g, "+");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
  loadedFonts.add(family);
}
