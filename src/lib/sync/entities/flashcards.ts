/**
 * Flashcard + review-history replication.
 *
 * Two replicated maps:
 *   - `learningItems` (row-lww) — the card rows including all SRS state
 *     (due_date, reps, lapses, stability/difficulty, algorithm_state, …).
 *     Whole-row last-writer-wins on the sync clock; a card reviewed on device A
 *     appears with its new schedule on device B.
 *   - `reviews` (append-only, deterministic id) — the review log. Keyed by
 *     `sha1(item_id "|" reviewed_at_ms "|" device_id)` so two devices reviewing
 *     the same card both count once, and a replayed update collapses to one row.
 *
 * Publish hooks are called from the write paths (`submitReview`, card CRUD).
 * The receive side calls the `upsert_synced_*` Tauri commands. Conflict
 * resolution lives in `replicatedMap.ts`; this module only supplies the
 * per-entity config and the publish entry points.
 *
 * NON-GOAL here: extracts/decks. Those are separate entity modules (planned).
 * For v1 we sync cards + reviews — the paramount case. Extract provenance
 * (`extract_id`) is carried on the card row and resolves once extracts sync.
 */

import { createReplicatedMap, type ReplicatedMap } from "../replicatedMap";
import { nowHLC, getDeviceId } from "../syncClock";
import { invokeCommand } from "../../tauri";

// --- wire types -------------------------------------------------------------
// Normalized shapes for the wire. We don't import the multiple divergent
// `LearningItem` TS interfaces (api/review.ts, api/learning-items.ts, types/*)
// to avoid coupling and field-name drift (snake_case vs camelCase). The Rust
// `LearningItem` model is the authority; it serializes snake_case via serde
// EXCEPT for a handful of fields. We match what the Tauri commands actually
// accept by reusing the same struct deserialization the existing review path
// uses — so the shape below mirrors `src/api/review.ts:LearningItem` plus the
// sync columns.

export interface SyncedLearningItem {
  id: string;
  collection_id: string;
  extract_id: string | null;
  document_id: string | null;
  item_type: string; // serde lowercases the enum variant
  question: string;
  answer: string | null;
  cloze_text: string | null;
  cloze_ranges: [number, number][] | null;
  difficulty: number;
  interval: number;
  ease_factor: number;
  due_date: string;
  date_created: string;
  date_modified: string;
  last_review_date: string | null;
  review_count: number;
  lapses: number;
  state: string; // lowercase: new/learning/review/relearning
  is_suspended: boolean;
  tags: string[];
  image_asset_ids: string[];
  interaction_metadata: unknown | null;
  memory_state: { stability: number; difficulty: number } | null;
  algorithm_type: string;
  algorithm_state: string | null;
  /** Sync clock (HLC). Drives row-LWW. Mirrors the DB column `updated_at`. */
  updated_at: string;
  /**
   * CamelCase alias required by the `replicatedMap` factory's structural
   * constraint (`{ updatedAt: string }`). Kept in sync with `updated_at` by
   * `toSyncedLearningItem`; both hold the same HLC string.
   */
  updatedAt: string;
}

export interface SyncedReviewResult {
  id: string;
  collection_id: string;
  session_id: string | null;
  item_id: string;
  rating: number;
  time_taken: number;
  new_due_date: string;
  new_interval: number;
  new_ease_factor: number;
  timestamp: string;
  reviewed_at_ms: number;
  device_id: string;
}

// --- singletons (lazily initialized) ---------------------------------------
let cardsMap: ReplicatedMap<SyncedLearningItem> | null = null;
let reviewsMap: ReplicatedMap<SyncedReviewResult & { updatedAt: string }> | null = null;

/**
 * Deterministic review id: `sha1(item_id "|" reviewed_at_ms "|" device_id)`.
 * Same event on two devices → two different ids (different device_id) so both
 * count. Same event replayed by one device → same id → collapses to one row
 * via the unique index / INSERT OR IGNORE.
 *
 * Uses WebCrypto SHA-1 (synchronous API unavailable; callers await). SHA-1 is
 * fine here — this is a dedup key, not a security primitive.
 */
export async function deterministicReviewId(
  itemId: string,
  reviewedAtMs: number,
  deviceId: string,
): Promise<string> {
  const input = `${itemId}|${reviewedAtMs}|${deviceId}`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback (older WebView): a simple non-crypto hash. Collisions extremely
  // unlikely for this input space, and the unique index still dedupes.
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

function getCardsMap(): ReplicatedMap<SyncedLearningItem> {
  if (!cardsMap) {
    cardsMap = createReplicatedMap<SyncedLearningItem>({
      name: "learningItems",
      label: "cards",
      mode: "row-lww",
      clockField: "updated_at",
      // Strip nothing — cards are small and all fields matter for scheduling.
      // (interaction_metadata can be sizeable for image-occlusion cards but is
      // part of the card definition and must travel with it.)
      getLocal: async (key) => {
        try {
          return await invokeCommand<SyncedLearningItem | null>("get_synced_learning_item", { id: key });
        } catch {
          return null;
        }
      },
      apply: async (_key, row) => {
        await invokeCommand("upsert_synced_learning_item", { item: row });
        // Notify the review UI to refresh its queue/store. Fire-and-forget.
        try {
          window.dispatchEvent(new CustomEvent("incrementum:synced-card", { detail: { id: row.id } }));
        } catch {
          /* non-Tauri / test */
        }
      },
      applyDelete: async (key) => {
        await invokeCommand("delete_synced_learning_item", { id: key });
        try {
          window.dispatchEvent(new CustomEvent("incrementum:synced-card-deleted", { detail: { id: key } }));
        } catch {
          /* ignore */
        }
      },
    });
  }
  return cardsMap;
}

function getReviewsMap(): ReplicatedMap<SyncedReviewResult & { updatedAt: string }> {
  if (!reviewsMap) {
    reviewsMap = createReplicatedMap<SyncedReviewResult & { updatedAt: string }>({
      name: "reviews",
      label: "reviews",
      mode: "append-only",
      // clockField irrelevant for append-only (apply always called), but the
      // factory requires updatedAt on the type — set it to the review timestamp.
      clockField: "updatedAt",
      apply: async (_key, row) => {
        await invokeCommand("upsert_synced_review_result", { review: row });
      },
      // Reviews are never deleted in normal use (they're an immutable log); no
      // applyDelete.
    });
  }
  return reviewsMap;
}

// --- publish entry points (called from write paths) -------------------------

/**
 * Normalize a raw `LearningItem` returned by a Tauri command into the
 * `SyncedLearningItem` wire shape. The Rust struct serializes snake_case (no
 * `rename_all`), but some call sites pass camelCase and the loose TS interfaces
 * accept both. This reads either form for every field so the publish path is
 * robust regardless of which command produced the object.
 */
export function toSyncedLearningItem(raw: Record<string, unknown>): SyncedLearningItem {
  const tags = pickArray(raw, ["tags"]);
  const imageAssetIds = pickArray(raw, ["image_asset_ids", "imageAssetIds"]);
  const updatedAt = pickStr(raw, ["updated_at", "updatedAt"]) ?? nowHLC();
  return {
    id: String(raw.id ?? ""),
    collection_id: pickStr(raw, ["collection_id", "collectionId"]) ?? DEFAULT_COLLECTION_ID,
    extract_id: pickStr(raw, ["extract_id", "extractId"]),
    document_id: pickStr(raw, ["document_id", "documentId"]),
    item_type: (pickStr(raw, ["item_type", "itemType"]) ?? "flashcard").toLowerCase(),
    question: String(raw.question ?? ""),
    answer: pickStr(raw, ["answer"]),
    cloze_text: pickStr(raw, ["cloze_text", "clozeText"]),
    cloze_ranges: (raw.cloze_ranges ?? raw.clozeRanges ?? null) as [number, number][] | null,
    difficulty: pickNum(raw, ["difficulty"], 3),
    interval: pickNum(raw, ["interval"], 0),
    ease_factor: pickNum(raw, ["ease_factor", "easeFactor"], 2.5),
    due_date: pickStr(raw, ["due_date", "dueDate"]) ?? new Date().toISOString(),
    date_created: pickStr(raw, ["date_created", "dateCreated"]) ?? new Date().toISOString(),
    date_modified: pickStr(raw, ["date_modified", "dateModified"]) ?? new Date().toISOString(),
    last_review_date: pickStr(raw, ["last_review_date", "lastReviewDate"]),
    review_count: pickNum(raw, ["review_count", "reviewCount"], 0),
    lapses: pickNum(raw, ["lapses"], 0),
    state: (pickStr(raw, ["state"]) ?? "new").toLowerCase(),
    is_suspended: pickBool(raw, ["is_suspended", "isSuspended"], false),
    tags,
    image_asset_ids: imageAssetIds,
    interaction_metadata: (raw.interaction_metadata ?? raw.interactionMetadata ?? null) as unknown,
    memory_state: (raw.memory_state ?? raw.memoryState ?? null) as { stability: number; difficulty: number } | null,
    algorithm_type: pickStr(raw, ["algorithm_type", "algorithmType"]) ?? "fsrs",
    algorithm_state: pickStr(raw, ["algorithm_state", "algorithmState"]),
    updated_at: updatedAt,
    updatedAt,
  };
}

const DEFAULT_COLLECTION_ID = "00000000-0000-0000-0000-000000000001";

function pickArray(raw: Record<string, unknown>, keys: string[]): string[] {
  for (const k of keys) {
    if (Array.isArray(raw[k])) return (raw[k] as unknown[]).map(String);
  }
  return [];
}
function pickStr(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    if (raw[k] !== undefined && raw[k] !== null) return String(raw[k]);
  }
  return null;
}
function pickNum(raw: Record<string, unknown>, keys: string[], def: number): number {
  for (const k of keys) {
    if (typeof raw[k] === "number") return raw[k] as number;
    if (raw[k] !== undefined && raw[k] !== null) {
      const n = Number(raw[k]);
      if (!Number.isNaN(n)) return n;
    }
  }
  return def;
}
function pickBool(raw: Record<string, unknown>, keys: string[], def: boolean): boolean {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
  }
  return def;
}

/**
 * Publish a card row after a local write (review, edit, create, suspend).
 * `row` must already carry a fresh `updated_at` from `nowHLC()`. Idempotent and
 * fire-and-forget — callers never block on sync. No-op outside Tauri.
 */
export async function publishCard(row: SyncedLearningItem): Promise<void> {
  await getCardsMap().publish(row.id, row);
}

/**
 * Record + publish a review event. Builds the deterministic id, stamps the sync
 * clock, and publishes to the append-only `reviews` map. Called by the review
 * submit path right after the local Tauri write succeeds. Fire-and-forget.
 *
 * @param itemId      the reviewed card's id
 * @param collectionId collection the card belongs to
 * @param rating       1=Again 2=Hard 3=Good 4=Easy
 * @param timeTaken    seconds spent on the card
 * @param resultDueDate resulting due date (RFC3339) from the scheduler
 * @param resultInterval resulting interval (days, may be fractional)
 * @param resultEase    resulting ease factor
 * @param sessionId     optional review session id
 */
export async function publishReview(args: {
  itemId: string;
  collectionId: string;
  rating: number;
  timeTaken: number;
  resultDueDate: string;
  resultInterval: number;
  resultEase: number;
  sessionId?: string;
}): Promise<void> {
  const deviceId = await getDeviceId();
  const reviewedAtMs = Date.now();
  const id = await deterministicReviewId(args.itemId, reviewedAtMs, deviceId);
  const review: SyncedReviewResult & { updatedAt: string } = {
    id,
    collection_id: args.collectionId,
    session_id: args.sessionId ?? null,
    item_id: args.itemId,
    rating: args.rating,
    time_taken: args.timeTaken,
    new_due_date: args.resultDueDate,
    new_interval: args.resultInterval,
    new_ease_factor: args.resultEase,
    timestamp: new Date(reviewedAtMs).toISOString(),
    reviewed_at_ms: reviewedAtMs,
    device_id: deviceId,
    updatedAt: nowHLC(),
  };
  await getReviewsMap().publish(id, review);
}

/** Warm up the maps (ensure Yjs observers are attached). Called on app boot. */
export async function ensureFlashcardSyncReady(): Promise<void> {
  await Promise.all([getCardsMap().ensureReady(), getReviewsMap().ensureReady()]);
}

export const __flashcardsSyncTest = {
  _reset: () => {
    cardsMap?.teardown();
    reviewsMap?.teardown();
    cardsMap = null;
    reviewsMap = null;
  },
  deterministicReviewId,
};
