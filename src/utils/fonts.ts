
import "@fontsource/inter"; // Critical default font — always loaded

const SYSTEM_FONTS = new Set(["system-ui", "serif", "sans-serif", "monospace"]);
const loadedFonts = new Set<string>();

/**
 * Map from user-facing font family names (as shown in Settings) to the
 * corresponding @fontsource npm package name.
 *
 * System fonts (system-ui, serif, sans-serif, monospace) don't need a package.
 */
const FONT_TO_PACKAGE: Record<string, string> = {
  // Sans Serif
  "Inter": "inter",
  "Outfit": "outfit",
  "Nunito": "nunito",
  "Poppins": "poppins",
  "Open Sans": "open-sans",
  "Lato": "lato",
  "Rubik": "rubik",
  "Lexend": "lexend",
  "Sora": "sora",
  "Plus Jakarta Sans": "plus-jakarta-sans",
  "DM Sans": "dm-sans",
  "Manrope": "manrope",
  "Space Grotesk": "space-grotesk",
  "Raleway": "raleway",
  "Josefin Sans": "josefin-sans",
  "Quicksand": "quicksand",
  "Montserrat": "montserrat",
  "Work Sans": "work-sans",
  "Barlow": "barlow",
  "Mulish": "mulish",
  "Karla": "karla",
  "Urbanist": "urbanist",
  "Albert Sans": "albert-sans",
  "Figtree": "figtree",
  "Syne": "syne",

  // Serif
  "Merriweather": "merriweather",
  "Playfair Display": "playfair-display",
  "Lora": "lora",
  "Crimson Text": "crimson-text",
  "Bitter": "bitter",

  // Monospace
  "JetBrains Mono": "jetbrains-mono",
  "Fira Code": "fira-code",
  "Source Code Pro": "source-code-pro",
  "IBM Plex Mono": "ibm-plex-mono",
  "Roboto Mono": "roboto-mono",
  "Ubuntu Mono": "ubuntu-mono",
  "Inconsolata": "inconsolata",
  "Space Mono": "space-mono",
  "Courier Prime": "courier-prime",
  "DM Mono": "dm-mono",
  "Anonymous Pro": "anonymous-pro",
  "PT Mono": "pt-mono",
  "Overpass Mono": "overpass-mono",
  "Noto Sans Mono": "noto-sans-mono",
  "Victor Mono": "victor-mono",
  "Red Hat Mono": "red-hat-mono",
  "Martian Mono": "martian-mono",
  "Oxygen Mono": "oxygen-mono",
  "Share Tech Mono": "share-tech-mono",
  "Azeret Mono": "azeret-mono",
  "Spline Sans Mono": "spline-sans-mono",
  "Xanh Mono": "xanh-mono",
  "Cutive Mono": "cutive-mono",
  "B612 Mono": "b612-mono",
  "Nova Mono": "nova-mono",
  "Syne Mono": "syne-mono",
  "Nanum Gothic Coding": "nanum-gothic-coding",
  "Cousine": "cousine",
  "Chivo Mono": "chivo-mono",
  "Fira Mono": "fira-mono",

  // Display / Decorative
  "Comic Neue": "comic-neue",
  "Major Mono Display": "major-mono-display",

  // Extra (not in settings UI but available)
  "IBM Plex Sans": "ibm-plex-sans",
  "Press Start 2P": "press-start-2p",
  "Source Serif 4": "source-serif-4",
};

/**
 * Dynamically load @fontsource packages for the given font families.
 * Only loads fonts that haven't been loaded yet (tracked by `loadedFonts`).
 * System fonts are skipped since they're already available.
 */
export async function loadSelectedFonts(fontFamilies: string[]): Promise<void> {
  const imports = fontFamilies
    .filter((family) => !SYSTEM_FONTS.has(family) && !loadedFonts.has(family))
    .map(async (family) => {
      const pkg = FONT_TO_PACKAGE[family];
      if (!pkg) return;
      try {
        await import(`@fontsource/${pkg}`);
        loadedFonts.add(family);
      } catch {
        console.warn(`[fonts] Failed to load @fontsource/${pkg}`);
      }
    });

  await Promise.all(imports);
}

/**
 * Ensure the given Google Font family is loaded (web/PWA mode).
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
