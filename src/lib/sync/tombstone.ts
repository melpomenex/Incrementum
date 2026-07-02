/**
 * Tombstone helpers for entity replication.
 *
 * Yjs `Y.Map.delete(key)` does NOT propagate a delete event to peers that join
 * the room *after* the delete — they observe the key as simply absent, which
 * is indistinguishable from "never existed" and means a deleted feed/card
 * would silently reappear on a freshly-installed device if it still existed
 * in that device's local SQLite.
 *
 * The fix (openspec design Decision 2): deletes write a tombstone marker into
 * the map instead of removing the key. Late joiners observe the tombstone and
 * delete their local row. Tombstones are GC'd after `TOMBSTONE_TTL_MS` (30
 * days) since the CRDT retains every map mutation forever; leaving stale
 * tombstones in would bloat the shared doc and slow every sync handshake.
 */

import { nowHLC } from "./syncClock";

export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface Tombstone {
  _deleted: true;
  deletedAt: string; // HLC string from syncClock
  deletedBy?: string; // device id (optional, for debugging)
}

export type Tombstoned<T> = (T & { updatedAt: string }) | Tombstone;

export function isTombstone<T>(value: unknown): value is Tombstone {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { _deleted?: unknown })._deleted === true
  );
}

/**
 * Mark a key as deleted in a Y.Map. Writes a tombstone rather than calling
 * `map.delete()` so peers (including late joiners) learn the entity is gone.
 */
export function writeTombstone<T extends object>(
  map: YMapLike<T>,
  key: string,
  deletedBy?: string,
): void {
  const tombstone: Tombstone = { _deleted: true, deletedAt: nowHLC(), deletedBy };
  map.set(key, tombstone as unknown as T);
}

/**
 * Garbage-collect tombstones older than `TOMBSTONE_TTL_MS`. Safe to call
 * opportunistically (e.g. on app launch after sync ready) — it only removes
 * tombstones that every device has had ample time to observe. A tombstone
 * younger than the TTL is left in place so a device that has been offline for
 * a week still learns about the delete on reconnect.
 *
 * Calls `map.delete()` directly (no re-broadcast) so GC itself doesn't create
 * new CRDT entries.
 */
export function gcTombstones<T extends object>(map: YMapLike<T>): number {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  let removed = 0;
  for (const key of Array.from(map.keys())) {
    const value = map.get(key);
    if (isTombstone(value) && toWallMs(value.deletedAt) < cutoff) {
      map.delete(key);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Convert an HLC string (preferred) or ISO timestamp to epoch milliseconds.
 * Returns 0 for unparseable input so GC treats it as ancient (safe).
 */
export function toWallMs(clock: string): number {
  const m = /^(\d{13})\./.exec(clock);
  if (m) return Number(m[1]);
  const parsed = Date.parse(clock);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Minimal Y.Map interface we depend on — keeps the helpers testable without a
// real Yjs doc and avoids importing Y types here.
export interface YMapLike<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
  keys(): Iterable<string>;
}
