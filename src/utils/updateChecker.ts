/**
 * Update checker utility for incrementum-tauri
 *
 * Fetches the latest release from GitHub and compares it with the current app version.
 */

const GITHUB_LATEST_RELEASE_URL =
  "https://api.github.com/repos/melpomenex/incrementum-tauri/releases/latest";
const SKIP_VERSION_KEY = "incrementum_skip_update_version";

export interface UpdateInfo {
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  releaseDate: string;
}

/**
 * Simple semver compare. Returns >0 if a > b, <0 if a < b, 0 if equal.
 */
function semverCompare(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);

  const pa = parse(a);
  const pb = parse(b);

  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Get the current app version.
 * Uses the Tauri API when available, otherwise returns null.
 */
export async function getCurrentVersion(): Promise<string | null> {
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return null;
  }
}

/**
 * Get the version the user has chosen to skip.
 */
export function getSkippedVersion(): string | null {
  return localStorage.getItem(SKIP_VERSION_KEY);
}

/**
 * Save a version to the skip list so we don't nag about it.
 */
export function setSkippedVersion(version: string): void {
  localStorage.setItem(SKIP_VERSION_KEY, version);
}

/**
 * Check for updates against the GitHub releases API.
 *
 * Returns `UpdateInfo` when a newer version is available, or `null` when
 * the app is up-to-date (or the check fails / the version is skipped).
 *
 * @param force  If true, ignores the skip-version preference.
 */
export async function checkForUpdates(
  force = false
): Promise<UpdateInfo | null> {
  try {
    const [currentVersion, res] = await Promise.all([
      getCurrentVersion(),
      fetch(GITHUB_LATEST_RELEASE_URL, {
        headers: { Accept: "application/vnd.github.v3+json" },
      }),
    ]);

    if (!res.ok) {
      // Rate-limited or other HTTP error
      console.warn(
        `[updateChecker] GitHub API returned ${res.status}: ${res.statusText}`
      );
      return null;
    }

    const data = await res.json();
    const latestVersion: string = data.tag_name ?? data.name ?? "";
    const body: string = data.body ?? "";
    const htmlUrl: string = data.html_url ?? "";
    const publishedAt: string = data.published_at ?? "";

    if (!latestVersion || !currentVersion) return null;

    // Check if the latest is actually newer
    if (semverCompare(latestVersion, currentVersion) <= 0) {
      return null; // up-to-date
    }

    // Respect the skip list (unless forced)
    if (!force && getSkippedVersion() === latestVersion) {
      return null;
    }

    return {
      latestVersion,
      releaseNotes: body,
      downloadUrl: htmlUrl,
      releaseDate: publishedAt,
    };
  } catch (err) {
    console.warn("[updateChecker] Failed to check for updates:", err);
    return null;
  }
}
