/**
 * Generic Yjs replication factory for "one row per key" entity types.
 *
 * This factors out the exact pattern proven by `documentReplication.ts` so each
 * new entity (flashcards, reviews, RSS, podcasts) needs only a small declarative
 * config instead of a copy of the whole module. The pattern is:
 *
 *   1. `doc.getMap<T>(name)` — one shared map per entity.
 *   2. `ensureReady()` — lazily attach an `observe` handler, replaying the
 *      existing map contents on first init; rebuild on room switch
 *      (`map.doc !== sync.doc`).
 *   3. `publish(row)` — write a local row to the map so peers receive it.
 *      The caller must stamp the row's sync-clock field (e.g. `updatedAt`)
 *      with `nowHLC()` *before* publishing; the receiver re-applies that same
 *      timestamp, so a re-broadcast of our own write no-ops (echo guard).
 *   4. `observe → handleRemote(key)` — for each changed key, read the remote
 *      value; skip tombstones already applied; skip rows not newer than local;
 *      otherwise call `config.apply` (which invokes a `upsert_synced_*` Tauri
 *      command). Tombstones call `config.applyDelete`.
 *
 * Conflict resolution is whole-row last-writer-wins on the configured clock
 * field, plus tombstones for deletes. Entities needing append-only or
 * field-level merge (review_results, rss_articles read/queued state) use the
 * `mode` option.
 *
 * CRITICAL doc-size discipline: the shared Yjs doc grows monotonically (every
 * mutation is a permanent tombstone). Never publish large/regenerable fields
 * (article HTML, audio bytes, cover data-URLs). `config.strip` removes those
 * before publishing, mirroring how `documentReplication` drops
 * `content`/`coverImageUrl`/`currentViewState`.
 */

import type * as Y from "yjs";
import { getYjsSync, registerRoomChangeListener } from "../yjsSync";
import { isTauri } from "../tauri";
import { isNewer, compareClock } from "./syncClock";
import {
  isTombstone,
  writeTombstone as writeTombstoneHelper,
  type Tombstoned,
} from "./tombstone";

export type MergeMode = "row-lww" | "append-only" | "field-lww";

export interface ReplicatedMapConfig<T extends { updatedAt: string }> {
  /** Yjs map name, e.g. "learningItems". */
  name: string;
  /** Stable label for logs. */
  label: string;
  /**
   * Merge strategy:
   *   - `row-lww`     — whole row wins if newer (default; cards, feeds).
   *   - `append-only` — always upsert by key, never skip by timestamp
   *                     (review_results keyed by deterministic id).
   *   - `field-lww`   — merge individual timestamped fields; `fieldClocks`
   *                     supplies the per-field clock fields (rss article
   *                     read/queued state, podcast position/played).
   */
  mode?: MergeMode;
  /** Clock field used for row-lww comparison. Defaults to "updatedAt". */
  clockField?: keyof T;
  /**
   * For `field-lww`: the fields whose values each carry their own clock (the
   * `*_at` companion columns). Receiver applies a remote field only if its
   * clock is newer than local. Each entry is `[valueField, clockField]`.
   */
  fieldClocks?: Array<[keyof T, keyof T]>;
  /**
   * Strip large/regenerable fields before publishing. Mirrors the
   * content/coverImageUrl/currentViewState strip in documentReplication.
   * Returns a shallow-cloned row with those fields removed.
   */
  strip?: (row: T) => Partial<T>;
  /**
   * Apply a remote row to local SQLite. Called only after the conflict check
   * passes. Receives the (possibly stripped) row plus the id under which it
   * was published. Implementations invoke a `upsert_synced_*` Tauri command.
   */
  apply: (key: string, row: T, ctx: ApplyContext) => Promise<void>;
  /** Apply a delete (tombstone) to local SQLite. Optional. */
  applyDelete?: (key: string, ctx: ApplyContext) => Promise<void>;
  /**
   * Read the local row for a key (used to decide if remote is newer). Return
   * null if absent. Implementations query SQLite or a store. For
   * `append-only` mode this can be omitted (apply is always called).
   */
  getLocal?: (key: string) => Promise<T | null>;
  /** Trailing debounce for high-churn publishes (position ticks), in ms. 0 = none. */
  debounceMs?: number;
  /** Whether to log verbose activity for debugging. */
  verbose?: boolean;
}

export interface ApplyContext {
  /** True when the receiver should treat this as a tombstone delete. */
}

interface InternalState<T> {
  map: Y.Map<Tombstoned<T>> | null;
  initialized: boolean;
  initPromise: Promise<void> | null;
  appliedTombstones: Set<string>;
  appliedClocks: Map<string, string>;
  pendingPublish: Map<string, ReturnType<typeof setTimeout>>;
  unregisterRoomChange: (() => void) | null;
}

export interface ReplicatedMap<T extends { updatedAt: string }> {
  ensureReady: () => Promise<void>;
  publish: (key: string, row: T) => Promise<void>;
  publishDebounced: (key: string, row: () => Promise<T>) => Promise<void>;
  delete: (key: string) => Promise<void>;
  gc: () => number;
  teardown: () => void;
  /** Direct map access (read-only intent) for migration/backfill callers. */
  getMap: () => Y.Map<Tombstoned<T>> | null;
}

/**
 * Create a replicated map for an entity. Registers a room-change listener so
 * the map re-inits against the new doc on room switch (mirrors documents).
 */
export function createReplicatedMap<T extends { updatedAt: string }>(
  config: ReplicatedMapConfig<T>,
): ReplicatedMap<T> {
  const mode = config.mode ?? "row-lww";
  const clockField = (config.clockField ?? "updatedAt") as keyof T;
  const debounceMs = config.debounceMs ?? 0;
  const log = config.verbose
    ? (...a: unknown[]) => console.debug(`[replicatedMap:${config.label}]`, ...a)
    : () => {};

  const state: InternalState<T> = {
    map: null,
    initialized: false,
    initPromise: null,
    appliedTombstones: new Set(),
    appliedClocks: new Map(),
    pendingPublish: new Map(),
    unregisterRoomChange: null,
  };

  async function ensureReady(): Promise<void> {
    const sync = await getYjsSync();
    if (state.initialized && state.map && state.map.doc === sync.doc) return;

    // Room switched (or first init) — tear down the old binding.
    if (state.map && state.map.doc !== sync.doc) {
      state.initialized = false;
      state.initPromise = null;
      state.map = null;
      state.appliedTombstones.clear();
      state.appliedClocks.clear();
    }

    if (!state.initPromise) {
      state.initPromise = (async () => {
        try {
          const sync = await getYjsSync();
          const map = sync.doc.getMap<Tombstoned<T>>(config.name);
          state.map = map;
          map.observe((event) => {
            for (const key of event.keysChanged) {
              void handleRemote(key);
            }
          });
          // Replay existing entries (e.g. rows published before this device joined).
          map.forEach((_value, key) => {
            void handleRemote(key);
          });
          // Opportunistic tombstone GC on init.
          try {
            const removed = gcTombstonesMap(map);
            if (removed > 0) log("gc'd", removed, "tombstones");
          } catch (err) {
            log("tombstone gc failed", err);
          }
          state.initialized = true;
        } catch (err) {
          state.initPromise = null;
          console.error(`[replicatedMap:${config.label}] init failed`, err);
          throw err;
        }
      })();
    }

    // Register the room-change listener once so a rejoin re-inits us.
    if (!state.unregisterRoomChange) {
      state.unregisterRoomChange = registerRoomChangeListener(async () => {
        // Defer slightly so yjsSync finishes rebuilding the doc/provider.
        await new Promise((r) => setTimeout(r, 100));
        try {
          await ensureReady();
        } catch (err) {
          log("room-change reinit failed", err);
        }
      });
    }

    return state.initPromise;
  }

  async function publish(key: string, row: T): Promise<void> {
    if (!isTauri()) return; // web/PWA doesn't publish via this path (v1).
    try {
      await ensureReady();
      if (!state.map) return;
      const wire = (config.strip ? config.strip(row) : row) as Tombstoned<T>;
      state.map.set(key, wire);
      log("published", key);
    } catch (err) {
      console.warn(`[replicatedMap:${config.label}] publish failed`, key, err);
    }
  }

  /**
   * Debounced publish for high-churn writes (e.g. podcast `timeupdate` ticks).
   * `rowProducer` is called only when the debounce flushes, so callers can
   * cheaply call this on every tick without issuing a SQLite read each time.
   */
  async function publishDebounced(key: string, rowProducer: () => Promise<T>): Promise<void> {
    if (!isTauri() || debounceMs <= 0) {
      const row = await rowProducer();
      return publish(key, row);
    }
    const existing = state.pendingPublish.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      state.pendingPublish.delete(key);
      void (async () => {
        try {
          const row = await rowProducer();
          await publish(key, row);
        } catch (err) {
          console.warn(`[replicatedMap:${config.label}] debounced publish failed`, key, err);
        }
      })();
    }, debounceMs);
    state.pendingPublish.set(key, timer);
  }

  async function del(key: string): Promise<void> {
    if (!isTauri()) return;
    try {
      await ensureReady();
      if (!state.map) return;
      writeTombstoneHelper(state.map, key);
      log("tombstoned", key);
    } catch (err) {
      console.warn(`[replicatedMap:${config.label}] delete failed`, key, err);
    }
  }

  function gc(): number {
    return state.map ? gcTombstonesMap(state.map) : 0;
  }

  function teardown(): void {
    if (state.unregisterRoomChange) {
      state.unregisterRoomChange();
      state.unregisterRoomChange = null;
    }
    for (const t of state.pendingPublish.values()) clearTimeout(t);
    state.pendingPublish.clear();
    state.map = null;
    state.initialized = false;
    state.initPromise = null;
  }

  async function handleRemote(key: string): Promise<void> {
    if (!isTauri() || !state.map) return;
    const remote = state.map.get(key);
    if (!remote) return; // absent — nothing to do (delete already applied or never existed)

    if (isTombstone(remote)) {
      // Idempotent: only apply the delete once per tombstone (keyed by deletedAt).
      const marker = `${key}:${remote.deletedAt}`;
      if (state.appliedTombstones.has(marker)) return;
      if (!config.applyDelete) return; // entity doesn't replicate deletes
      state.appliedTombstones.add(marker);
      try {
        await config.applyDelete(key, {});
        log("applied delete", key);
      } catch (err) {
        state.appliedTombstones.delete(marker); // allow retry
        console.warn(`[replicatedMap:${config.label}] applyDelete failed`, key, err);
      }
      return;
    }

    const remoteClock = String(remote[clockField] ?? "");

    if (mode === "append-only") {
      // Reviews: always upsert by deterministic id; INSERT OR IGNORE dedupes.
      await runApply(key, remote, remoteClock);
      return;
    }

    if (mode === "field-lww") {
      // Fetch local once, then decide per-field.
      const local = config.getLocal ? await safeGetLocal(key) : null;
      const merged = local ? mergeFieldLww(local, remote, config.fieldClocks ?? []) : remote;
      await runApply(key, merged, remoteClock);
      return;
    }

    // row-lww
    const local = config.getLocal ? await safeGetLocal(key) : null;
    if (local) {
      const localClock = String(local[clockField] ?? "");
      if (!isNewer(remoteClock, localClock)) {
        return; // local is at least as new — don't clobber (echo guard lives here too)
      }
    }
    await runApply(key, remote, remoteClock);
  }

  async function runApply(key: string, row: T, clock: string): Promise<void> {
    // Idempotency for rapid re-broadcasts: skip if we already applied this clock.
    const prev = state.appliedClocks.get(key);
    if (prev && compareClock(clock, prev) <= 0) {
      return;
    }
    try {
      await config.apply(key, row, {});
      state.appliedClocks.set(key, clock);
      log("applied", key);
    } catch (err) {
      console.warn(`[replicatedMap:${config.label}] apply failed`, key, err);
    }
  }

  async function safeGetLocal(key: string): Promise<T | null> {
    try {
      return (await config.getLocal!(key)) ?? null;
    } catch (err) {
      log("getLocal failed", key, err);
      return null;
    }
  }

  return {
    ensureReady,
    publish,
    publishDebounced,
    delete: del,
    gc,
    teardown,
    getMap: () => state.map,
  };
}

/**
 * Merge remote fields into a local row under field-level LWW. For each
 * `[valueField, clockField]` pair, the remote value wins only if its clock is
 * newer than the local clock. Fields not listed are taken from the row whose
 * `updatedAt` is newer (so non-churn metadata still converges via row-LWW).
 */
function mergeFieldLww<T extends { updatedAt: string }>(
  local: T,
  remote: T,
  fieldClocks: Array<[keyof T, keyof T]>,
): T {
  const rowNewer = isNewer(remote.updatedAt, local.updatedAt);
  const base = (rowNewer ? { ...remote } : { ...local }) as T;

  for (const [valueField, clockField] of fieldClocks) {
    const remoteFieldClock = String(remote[clockField] ?? "");
    const localFieldClock = String(local[clockField] ?? "");
    // Take the remote value if its per-field clock is newer, OR if local has
    // no clock for this field yet (newly added by a migration).
    if (isNewer(remoteFieldClock, localFieldClock) || (!localFieldClock && remoteFieldClock)) {
      (base as Record<string, unknown>)[valueField as string] =
        remote[valueField as unknown as keyof T];
      (base as Record<string, unknown>)[clockField as string] = remoteFieldClock;
    } else {
      (base as Record<string, unknown>)[valueField as string] =
        local[valueField as unknown as keyof T];
      (base as Record<string, unknown>)[clockField as string] = localFieldClock;
    }
  }
  return base;
}

function gcTombstonesMap<T extends { updatedAt: string }>(
  map: Y.Map<Tombstoned<T>>,
): number {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const key of Array.from(map.keys())) {
    const value = map.get(key);
    if (isTombstone(value)) {
      const m = /^(\d{13})\./.exec(value.deletedAt);
      const ms = m ? Number(m[1]) : Date.parse(value.deletedAt);
      if (!Number.isNaN(ms) && ms < cutoff) {
        map.delete(key);
        removed += 1;
      }
    }
  }
  return removed;
}
