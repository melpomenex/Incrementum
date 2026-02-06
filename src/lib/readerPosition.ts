import type { ViewState, PdfDest } from "../types/readerPosition";

const STORAGE_PREFIX = "document-view-state:";
const STORAGE_PREFIX_V2 = "document-view-state:v2:";
const DEFAULT_DEBOUNCE_MS = 350;

const pendingWrites = new Map<string, number>();
const pendingStates = new Map<string, ViewState>();
const lastSerialized = new Map<string, string>();

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const normalizeDest = (dest?: PdfDest | null): PdfDest | null => {
  if (!dest) return null;
  return {
    kind: dest.kind,
    left: typeof dest.left === "number" ? roundTo(dest.left, 2) : null,
    top: typeof dest.top === "number" ? roundTo(dest.top, 2) : null,
    zoom: typeof dest.zoom === "number" ? roundTo(dest.zoom, 2) : null,
  };
};

const normalizeViewState = (state: ViewState): Omit<ViewState, "updatedAt"> => {
  return {
    docId: state.docId,
    pageNumber: state.pageNumber,
    scale: roundTo(state.scale, 3),
    zoomMode: state.zoomMode,
    rotation: state.rotation,
    viewMode: state.viewMode,
    dest: normalizeDest(state.dest ?? null),
    scrollTop: typeof state.scrollTop === "number" ? Math.round(state.scrollTop) : null,
    scrollLeft: typeof state.scrollLeft === "number" ? Math.round(state.scrollLeft) : null,
    scrollPercent: typeof state.scrollPercent === "number" ? roundTo(state.scrollPercent, 2) : null,
    version: state.version,
  };
};

const serializeNormalized = (state: ViewState) => {
  return JSON.stringify(normalizeViewState(state));
};

const isBrowser = () => typeof window !== "undefined" && !!window.localStorage;

const getCurrentUserId = (): string | null => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem("incrementum_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown } | null;
    const id = parsed && typeof parsed === "object" ? (parsed as any).id : null;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
};

export const getViewStateKey = (options: {
  documentId?: string | null;
  contentHash?: string | null;
  pdfFingerprint?: string | null;
}): string | null => {
  const docId = options.documentId?.trim();
  if (docId) return `${STORAGE_PREFIX}${docId}`;
  const contentHash = options.contentHash?.trim();
  if (contentHash) return `${STORAGE_PREFIX}hash:${contentHash}`;
  const fingerprint = options.pdfFingerprint?.trim();
  if (fingerprint) return `${STORAGE_PREFIX}fingerprint:${fingerprint}`;
  return null;
};

/**
 * Preferred key for durable view-state persistence.
 *
 * - Includes a user/profile namespace when available to avoid collisions on shared devices.
 * - Prefers stable document identity (content hash or PDF fingerprint) over internal document IDs.
 * - Uses a versioned prefix so we can evolve keying without breaking legacy lookup.
 */
export const getPreferredViewStateKey = (options: {
  documentId?: string | null;
  contentHash?: string | null;
  pdfFingerprint?: string | null;
  profileId?: string | null;
}): string | null => {
  const profileId = options.profileId?.trim() || getCurrentUserId();
  const ns = profileId ? `u:${profileId}:` : "anon:";

  const contentHash = options.contentHash?.trim();
  if (contentHash) return `${STORAGE_PREFIX_V2}${ns}hash:${contentHash}`;

  const fingerprint = options.pdfFingerprint?.trim();
  if (fingerprint) return `${STORAGE_PREFIX_V2}${ns}fingerprint:${fingerprint}`;

  const docId = options.documentId?.trim();
  if (docId) return `${STORAGE_PREFIX_V2}${ns}doc:${docId}`;

  return null;
};

export const getViewStateKeyCandidates = (options: {
  documentId?: string | null;
  contentHash?: string | null;
  pdfFingerprint?: string | null;
  profileId?: string | null;
}): string[] => {
  const keys: string[] = [];

  const preferred = getPreferredViewStateKey(options);
  if (preferred) keys.push(preferred);

  // Legacy ordering, plus explicit stable fallbacks even when a documentId is present.
  const legacyDoc = options.documentId?.trim();
  if (legacyDoc) keys.push(`${STORAGE_PREFIX}${legacyDoc}`);

  const legacyHash = options.contentHash?.trim();
  if (legacyHash) keys.push(`${STORAGE_PREFIX}hash:${legacyHash}`);

  const legacyFp = options.pdfFingerprint?.trim();
  if (legacyFp) keys.push(`${STORAGE_PREFIX}fingerprint:${legacyFp}`);

  // Deduplicate while preserving order.
  return Array.from(new Set(keys));
};

export const parseViewState = (raw: string): ViewState | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ViewState> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.docId !== "string" || typeof parsed.pageNumber !== "number") return null;
    if (typeof parsed.scale !== "number") return null;
    if (typeof parsed.updatedAt !== "number") return null;
    return parsed as ViewState;
  } catch {
    return null;
  }
};

export const getViewState = (key: string): ViewState | null => {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  return parseViewState(raw);
};

export const clearViewState = (key: string): void => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key);
};

const persistNow = (key: string, state: ViewState): void => {
  if (!isBrowser()) return;
  const serialized = serializeNormalized(state);
  lastSerialized.set(key, serialized);
  window.localStorage.setItem(
    key,
    JSON.stringify({ ...state, updatedAt: state.updatedAt || Date.now() })
  );
};

export const flushViewState = (key: string): void => {
  if (!isBrowser()) return;
  const existingTimer = pendingWrites.get(key);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
    pendingWrites.delete(key);
  }
  const state = pendingStates.get(key);
  if (!state) return;
  pendingStates.delete(key);
  persistNow(key, state);
};

export const flushAllViewStateWrites = (): void => {
  if (!isBrowser()) return;
  for (const key of Array.from(pendingWrites.keys())) {
    flushViewState(key);
  }
};

export const setViewState = (
  key: string,
  state: ViewState,
  options?: { debounceMs?: number }
): void => {
  if (!isBrowser()) return;
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const normalized = serializeNormalized(state);
  if (lastSerialized.get(key) === normalized) return;

  pendingStates.set(key, state);
  const existingTimer = pendingWrites.get(key);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timer = window.setTimeout(() => {
    pendingWrites.delete(key);
    const pending = pendingStates.get(key) ?? state;
    pendingStates.delete(key);
    const finalNormalized = serializeNormalized(pending);
    if (lastSerialized.get(key) === finalNormalized) return;
    persistNow(key, pending);
  }, debounceMs);

  pendingWrites.set(key, timer);
};

export const serializeViewState = (state?: ViewState | string | null): string | null => {
  if (!state) return null;
  if (typeof state === "string") return state;
  return JSON.stringify(state);
};
