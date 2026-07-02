#!/usr/bin/env bash
#
# Garbage-collect the sync file-service blob store.
#
# Runs in three tiers, each strictly safer than the next. Designed to run from
# cron — it logs everything to $LOG_FILE and exits non-zero only on real
# trouble, so a cron failure is visible.
#
#   Tier 1 (always): orphaned blobs/meta with no counterpart. These are
#                    broken/partial uploads — deleting them frees space and
#                    can never affect a live file.
#   Tier 2 (always): soft-deleted files (meta.deletedAt set). The app's DELETE
#                    handler tombstones files rather than removing bytes; this
#                    reclaims that space. A file marked deleted is, by
#                    definition, not referenced anymore.
#   Tier 3 (conditional, LRU): only if total blob size exceeds SIZE_CAP_MB,
#                    delete the least-recently-accessed LIVE files (by
#                    lastAccessedAt) until under the cap. The GRACE_DAYS
#                    window protects recently-accessed files from ever being
#                    evicted, so an active user never has a file pulled.
#
# USAGE
#   ./gc-files.sh                  # tiers 1+2, dry-run LRU report (no deletion)
#   ./gc-files.sh --apply          # tiers 1+2 delete; LRU only if over cap
#   SIZE_CAP_MB=8000 ./gc-files.sh --apply   # also evict LRU to stay under 8GB
#
# Config via env (all optional):
#   FILES_DIR      blob root (default: /home/leisrich/yjs-sync/data/files)
#   SIZE_CAP_MB    LRU threshold in MiB (default: 0 = disabled)
#   GRACE_DAYS     protect files accessed within N days from LRU (default: 14)
#   LOG_FILE       log destination (default: <FILES_DIR>/../gc-files.log)
#   KEEP_DAYS_META after deleting a blob, keep its .json this long (default: 7)
#
# The script never touches the frame-log dir or the yjs leveldb persistence —
# those are bounded by their own mechanisms.
#
set -euo pipefail

APPLY=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

FILES_DIR="${FILES_DIR:-/home/leisrich/yjs-sync/data/files}"
SIZE_CAP_MB="${SIZE_CAP_MB:-0}"
GRACE_DAYS="${GRACE_DAYS:-14}"
LOG_FILE="${LOG_FILE:-/home/leisrich/yjs-sync/data/gc-files.log}"
KEEP_DAYS_META="${KEEP_DAYS_META:-7}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"; }

mkdir -p "$FILES_DIR"
touch "$LOG_FILE"

log "===== file-service GC start (apply=${APPLY}, cap=${SIZE_CAP_MB}MB, grace=${GRACE_DAYS}d) ====="
log "scanning $FILES_DIR"

# ---- Tier 1: orphaned blobs/meta -------------------------------------------
# A pair is <id>.bin + <id>.json in the same room dir. An orphan .bin has no
# .json (partial upload where the meta write never happened); an orphan .json
# has no .bin (blob already gone). Both are safe to remove unconditionally.
orphan_bin=0; orphan_json=0; orphan_bytes=0
while IFS= read -r -d '' binfile; do
  id="${binfile%.bin}"
  if [[ ! -f "${id}.json" ]]; then
    sz=$(stat -c %s "$binfile" 2>/dev/null || echo 0)
    orphan_bytes=$((orphan_bytes + sz))
    orphan_bin=$((orphan_bin + 1))
    if [[ "$APPLY" -eq 1 ]]; then rm -f -- "$binfile"; fi
  fi
done < <(find "$FILES_DIR" -type f -name '*.bin' -print0)

while IFS= read -r -d '' jsonfile; do
  id="${jsonfile%.json}"
  if [[ ! -f "${id}.bin" ]]; then
    orphan_json=$((orphan_json + 1))
    if [[ "$APPLY" -eq 1 ]]; then rm -f -- "$jsonfile"; fi
  fi
done < <(find "$FILES_DIR" -type f -name '*.json' -print0)

log "tier1 orphans: ${orphan_bin} bin ($((orphan_bytes / 1024 / 1024))MB), ${orphan_json} json — $([ "$APPLY" = 1 ] && echo removed || echo 'would-remove')"

# ---- Tier 2: soft-deleted files --------------------------------------------
# meta.deletedAt is set by the app's DELETE handler (tombstone). The bytes are
# unreferenced; reclaim them. Keep the .json briefly (KEEP_DAYS_META) so the
# tombstone is observable, then drop it too.
deleted_count=0; deleted_bytes=0
cutoff_meta=$(( $(date +%s) - KEEP_DAYS_META * 86400 ))
while IFS= read -r -d '' jsonfile; do
  # A deleted file looks like: "deletedAt": "2026-..." (non-null).
  if grep -q '"deletedAt"[[:space:]]*:[[:space:]]*"[0-9]' "$jsonfile"; then
    id="${jsonfile%.json}"
    binfile="${id}.bin"
    sz=0
    if [[ -f "$binfile" ]]; then
      sz=$(stat -c %s "$binfile" 2>/dev/null || echo 0)
      deleted_bytes=$((deleted_bytes + sz))
      if [[ "$APPLY" -eq 1 ]]; then rm -f -- "$binfile"; fi
    fi
    deleted_count=$((deleted_count + 1))
    # Drop the tombstone meta itself if it's old enough.
    mtime=$(stat -c %Y "$jsonfile" 2>/dev/null || echo 0)
    if [[ "$APPLY" -eq 1 && "$mtime" -lt "$cutoff_meta" ]]; then
      rm -f -- "$jsonfile"
    fi
  fi
done < <(find "$FILES_DIR" -type f -name '*.json' -print0)
log "tier2 soft-deleted: ${deleted_count} files ($((deleted_bytes / 1024 / 1024))MB) — $([ "$APPLY" = 1 ] && echo removed || echo 'would-remove')"

# ---- Tier 3: LRU eviction under cap ----------------------------------------
# Only if a cap is set and the live blob total exceeds it. Evict least-
# recently-accessed (by lastAccessedAt) LIVE files first, but never within the
# grace window. Builds a candidate list sorted oldest-access first and removes
# until under cap. Dry-run by default (cap=0 => skip entirely).
current_mb=$(find "$FILES_DIR" -type f -name '*.bin' -printf '%s\n' 2>/dev/null | awk '{s+=$1} END {printf "%d", s/1048576}')
log "current live blob total: ${current_mb}MB"

evicted=0; evicted_bytes=0
if [[ "$SIZE_CAP_MB" -gt 0 && "$current_mb" -gt "$SIZE_CAP_MB" ]]; then
  if [[ "$APPLY" -eq 0 ]]; then
    log "tier3 OVER CAP (${current_mb}MB > ${SIZE_CAP_MB}MB) — dry-run, reporting only"
  else
    log "tier3 OVER CAP (${current_mb}MB > ${SIZE_CAP_MB}MB) — evicting LRU (grace ${GRACE_DAYS}d)"
    grace_cutoff=$(date -u -d "${GRACE_DAYS} days ago" +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -v-${GRACE_DAYS}d +%Y-%m-%dT%H:%M:%S)
    # Emit: lastAccessedAt<TAB>bytes<TAB>jsonpath  for live files past grace,
    # sorted oldest-first. lastAccessedAt may be absent (use createdAt; if both
    # absent, treat as ancient = evictable first).
    while IFS=$'\t' read -r accessed sz jsonpath; do
      [[ "$current_mb" -le "$SIZE_CAP_MB" ]] && break
      id="${jsonpath%.json}"
      binpath="${id}.bin"
      [[ -f "$binpath" ]] || continue
      rm -f -- "$binpath"
      # Tombstone the meta so the app sees the file as gone, not missing.
      python3 - "$jsonpath" <<'PY' 2>/dev/null || true
import json, sys, datetime
p = sys.argv[1]
try:
    m = json.load(open(p))
    m["deletedAt"] = datetime.datetime.utcnow().isoformat() + "Z"
    m["evictedAt"] = "lru-gc"
    json.dump(m, open(p, "w"))
except Exception:
    pass
PY
      evicted=$((evicted + 1))
      evicted_bytes=$((evicted_bytes + sz))
      current_mb=$((current_mb - sz / 1048576))
    done < <(
      find "$FILES_DIR" -type f -name '*.json' -print0 \
        | xargs -0 grep -l '"deletedAt"[[:space:]]*:[[:space:]]*null' 2>/dev/null \
        | while IFS= read -r jp; do
            acc=$(python3 -c "
import json,sys
try:
    m=json.load(open('$jp'))
    print(m.get('lastAccessedAt') or m.get('createdAt') or '0000')
except: print('0000')
" 2>/dev/null)
            sz=$(python3 -c "import json;print(json.load(open('$jp')).get('sizeBytes',0))" 2>/dev/null || echo 0)
            # Only candidates past the grace window.
            if [[ "$acc" < "$grace_cutoff" ]]; then
              printf '%s\t%s\t%s\n' "$acc" "$sz" "$jp"
            fi
          done | sort
    )
    log "tier3 evicted: ${evicted} files ($((evicted_bytes / 1024 / 1024))MB)"
  fi
else
  log "tier3 skipped (cap=${SIZE_CAP_MB}MB ${SIZE_CAP_MB:+not }exceeded)"
fi

after_mb=$(find "$FILES_DIR" -type f -name '*.bin' -printf '%s\n' 2>/dev/null | awk '{s+=$1} END {printf "%d", s/1048576}')
log "after: ${after_mb}MB live blobs. done."
