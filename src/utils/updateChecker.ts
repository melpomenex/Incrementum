/**
 * Update checker utility for incrementum-tauri
 *
 * Two paths:
 * - Desktop (Tauri): uses `@tauri-apps/plugin-updater`, which fetches a signed
 *   `latest.json` manifest and verifies the bundle signature. The returned
 *   `Update` object can be passed to `installUpdate()` for an in-place update.
 * - Browser / PWA: falls back to the GitHub Releases API and reports the
 *   release URL (the user downloads the installer manually).
 */

import { isTauri } from "../lib/tauri";

const GITHUB_LATEST_RELEASE_URL =
  "https://api.github.com/repos/melpomenex/incrementum-tauri/releases/latest";
const SKIP_VERSION_KEY = "incrementum_skip_update_version";

// Re-export the updater's Update type lazily via a structural alias so callers
// in UpdateAvailableDialog can call `.downloadAndInstall()` without a hard
// import in this module's public surface.
export type UpdaterHandle = {
  /** Progress callback: receives 0–1 fraction and total downloaded/content-length bytes. */
  downloadAndInstall(
    onProgress?: (fraction: number) => void
  ): Promise<void>;
};

export interface UpdateInfo {
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  releaseDate: string;
  /**
   * Desktop-only: an opaque handle whose `downloadAndInstall()` performs the
   * signed in-place update. `null` in the browser/PWA path (manual download).
   */
  updater: UpdaterHandle | null;
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
 * Relaunch the app after an in-place update. Desktop-only; no-op otherwise.
 */
export async function relaunchApp(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (err) {
    console.warn("[updateChecker] relaunch failed:", err);
  }
}

/**
 * Desktop path: consult the Tauri updater plugin. Returns an `UpdateInfo`
 * whose `updater` field can perform a signed in-place install, or `null`
 * when up-to-date / unavailable.
 */
async function checkViaTauriUpdater(
  force: boolean
): Promise<UpdateInfo | null> {
  const { check } = await import("@tauri-apps/plugin-updater");

  // `check()` already compares versions against the running app and returns
  // `null` when current. It reads the endpoint + pubkey from tauri.conf.json.
  const update = await check();
  if (!update) return null;

  const latestVersion = update.version;

  // Respect the skip list (unless forced) even though the updater found one.
  if (!force && getSkippedVersion() === latestVersion) {
    return null;
  }

  return {
    latestVersion,
    releaseNotes: update.body ?? "",
    // Tauri's Update object does not expose the bundle URL to JS; the manifest
    // lives on the release page, which we link as the manual-download fallback.
    downloadUrl: `https://github.com/melpomenex/incrementum-tauri/releases/tag/v${latestVersion.replace(/^v/, "")}`,
    releaseDate: update.date ?? "",
    updater: {
      downloadAndInstall: async (onProgress?: (fraction: number) => void) => {
        let total = 0;
        let downloaded = 0;
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case "Started":
              total = event.data.contentLength ?? 0;
              break;
            case "Progress":
              downloaded += event.data.chunkLength;
              if (onProgress && total > 0) {
                onProgress(downloaded / total);
              }
              break;
            case "Finished":
              if (onProgress) onProgress(1);
              break;
          }
        });
        await update.close();
      },
    },
  };
}

/**
 * Browser/PWA path: query the GitHub Releases API.
 */
async function checkViaGitHub(
  force: boolean
): Promise<UpdateInfo | null> {
  const currentVersion = await getCurrentVersion();

  const res = await fetch(GITHUB_LATEST_RELEASE_URL, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  if (!res.ok) {
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

  if (semverCompare(latestVersion, currentVersion) <= 0) {
    return null; // up-to-date
  }

  if (!force && getSkippedVersion() === latestVersion) {
    return null;
  }

  return {
    latestVersion,
    releaseNotes: body,
    downloadUrl: htmlUrl,
    releaseDate: publishedAt,
    updater: null,
  };
}

/**
 * Check for updates.
 *
 * - On desktop (Tauri): uses the signed-manifest updater and returns an
 *   installable handle.
 * - On browser/PWA: falls back to the GitHub Releases API (manual download).
 *
 * Returns `UpdateInfo` when a newer version is available, or `null` when
 * up-to-date, skipped, or the check fails.
 *
 * @param force  If true, ignores the skip-version preference.
 */
export async function checkForUpdates(
  force = false
): Promise<UpdateInfo | null> {
  try {
    if (isTauri()) {
      return await checkViaTauriUpdater(force);
    }
    return await checkViaGitHub(force);
  } catch (err) {
    console.warn("[updateChecker] Failed to check for updates:", err);
    // Last-resort fallback: if the desktop updater throws (e.g. offline /
    // manifest fetch failure), try the GitHub API so the user still sees
    // something useful.
    try {
      return await checkViaGitHub(force);
    } catch {
      return null;
    }
  }
}
