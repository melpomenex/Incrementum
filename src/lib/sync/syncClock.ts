/**
 * Monotonic sync clock + per-device identity.
 *
 * All sync `updated_at` / `*_at` fields are written through `nowHLC()` so two
 * devices editing the same row while offline can never produce an ambiguous
 * tie. The value is a "hybrid logical clock"-ish string: millisecond wall time
 * followed by a per-process counter, with the device id as the final
 * tiebreaker consumed by the comparison helper.
 *
 * The wire format is intentionally sortable as a string:
 *   `<13-digit ms>.<6-digit counter>`
 * e.g. `1750000000000.000003`. Lexicographic compare matches chronological
 * order because both halves are zero-padded fixed width. This is what makes
 * the timestamp-based last-writer-wins merge in `replicatedMap.ts` correct.
 *
 * `getDeviceId()` is a stable random id per install (persisted in SQLite via a
 * Tauri command and mirrored in localStorage). It is the third term of the
 * deterministic review id (`sha1(item_id "|" reviewed_at_ms "|" device_id)`)
 * and disambiguates two reviews that happen within the same millisecond on
 * different devices.
 */

const DEVICE_ID_STORAGE_KEY = "incrementum_sync_device_id";
const COUNTER_STORAGE_KEY = "incrementum_sync_hlc_counter";

let cachedDeviceId: string | null = null;
let lastWallMs = 0;
let counter = 0;

// Restore the counter from localStorage on load so a reload doesn't reset it
// (mitigates a theoretical tie if the page is refreshed mid-second).
if (typeof window !== "undefined" && window.localStorage) {
  const stored = window.localStorage.getItem(COUNTER_STORAGE_KEY);
  if (stored) {
    const parsed = Number.parseInt(stored, 10);
    if (Number.isFinite(parsed)) counter = parsed;
  }
}

/**
 * Return the current monotonic clock value as a sortable string. Monotonic
 * within a device across calls and across reloads; combined with `getDeviceId`
 * it is globally unique for practical purposes.
 */
export function nowHLC(): string {
  const wall = Date.now();
  if (wall > lastWallMs) {
    lastWallMs = wall;
    counter = 0;
  } else {
    counter += 1;
  }
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(COUNTER_STORAGE_KEY, String(counter));
  }
  return `${String(wall).padStart(13, "0")}.${String(counter).padStart(6, "0")}`;
}

/**
 * RFC3339 timestamp for columns typed as TEXT dates (back-compat with the
 * existing `date_modified` etc. columns). Use `nowHLC()` for the dedicated
 * sync-clock columns; use `nowISO()` only when storing into a legacy column.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Compare two clock values (either HLC strings or ISO strings). Returns
 * negative if `a` is older, positive if `a` is newer, 0 if equal. HLC strings
 * are zero-padded so lexicographic compare is correct; ISO strings are also
 * lexicographically ordered at second resolution. Mixed inputs are compared by
 * parsed time, falling back to string compare.
 */
export function compareClock(a: string | null | undefined, b: string | null | undefined): number {
  const aStr = a ?? "";
  const bStr = b ?? "";
  // Absent (null/empty) is older than any real value. This matters for the
  // conflict check: a remote row with a clock should win over a missing local
  // row, and a present local row should win over a missing remote.
  if (aStr === "" && bStr === "") return 0;
  if (aStr === "") return -1;
  if (bStr === "") return 1;
  if (aStr === bStr) return 0;
  // HLC format starts with 13 digits + "."; ISO starts with a 4-digit year.
  const aIsHlc = /^\d{13}\./.test(aStr);
  const bIsHlc = /^\d{13}\./.test(bStr);
  if (aIsHlc && bIsHlc) {
    return aStr < bStr ? -1 : 1;
  }
  if (aIsHlc !== bIsHlc) {
    // Mixed: extract the wall-ms prefix and compare numerically.
    const aMs = aIsHlc ? Number(aStr.slice(0, 13)) : Date.parse(aStr);
    const bMs = bIsHlc ? Number(bStr.slice(0, 13)) : Date.parse(bStr);
    if (aMs === bMs) return aStr < bStr ? -1 : 1;
    return aMs - bMs;
  }
  // Both ISO.
  const aMs = Date.parse(aStr);
  const bMs = Date.parse(bStr);
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return aStr < bStr ? -1 : 1;
  if (aMs === bMs) return aStr < bStr ? -1 : 1;
  return aMs - bMs;
}

/** True if `a` is strictly newer than `b`. */
export function isNewer(a: string | null | undefined, b: string | null | undefined): boolean {
  return compareClock(a, b) > 0;
}

/**
 * Stable per-install device id. Tries the Tauri backend first (so the id
 * survives cache clears and is shared across windows on the same install),
 * then localStorage. Generates and persists on first call.
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  // Check localStorage synchronously first (fast path).
  if (typeof window !== "undefined" && window.localStorage) {
    const local = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (local) {
      cachedDeviceId = local;
      return local;
    }
  }

  // Try the Tauri backend (single source of truth, survives cache clears).
  let deviceId: string | null = null;
  try {
    // Lazy import to avoid loading the Tauri shim in non-Tauri contexts.
    const { isTauri, invokeCommand } = await import("../tauri");
    if (isTauri()) {
      deviceId = await invokeCommand<string>("get_or_create_sync_device_id");
    }
  } catch {
    // Non-Tauri or command missing — fall through to local generation.
  }

  if (!deviceId) {
    // Generate a v4-ish UUID without depending on crypto.randomUUID (older
    // WebViews). Sufficient entropy for a device id.
    deviceId = generateUuid();
  }

  cachedDeviceId = deviceId;
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Synchronous accessor for contexts that cannot await (e.g. deterministic-id
 * derivation inside a tight loop). Returns the cached id, or a fresh
 * localStorage-cached id, or null if `getDeviceId()` hasn't resolved yet.
 */
export function getDeviceIdSync(): string | null {
  if (cachedDeviceId) return cachedDeviceId;
  if (typeof window !== "undefined" && window.localStorage) {
    const local = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (local) {
      cachedDeviceId = local;
      return local;
    }
  }
  return null;
}

/** Allow tests / migration runner to warm the cache explicitly. */
export function warmDeviceId(id: string): void {
  cachedDeviceId = id;
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
  }
}

function generateUuid(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // RFC 4122 v4: set version and variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

export const __syncClockTest = { reset: () => { cachedDeviceId = null; lastWallMs = 0; counter = 0; } };
