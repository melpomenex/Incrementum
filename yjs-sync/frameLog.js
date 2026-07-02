/**

 Encrypted-frame persistence for the forked y-websocket relay (task 1.8b).

 WHY THIS EXISTS
 ───────────────
 The fork's `messageListener` `default` case forwards encrypted sync frames
 (type `0x10`) to other live connections, but does NOT apply them to the
 server's Yjs doc (the server can't — they're AES-GCM ciphertext) and does NOT
 persist them. So if every client in a room disconnects, the next client to
 connect finds an empty room from the relay's perspective — async state sync
 (device A writes at 9am, device B downloads at noon) is impossible.

 Combined with each client's local IndexedDB replica (`y-indexeddb`), a rolling
 server-side log of recent encrypted frames fixes this: device A's writes land
 in the log; when device B connects hours/days later, the log is replayed to it
 verbatim before live forwarding begins. Either source (server log or any
 client's full replica) is sufficient to seed a new device; both together make
 the "pick up where you left off, anytime, on any device" guarantee robust even
 if the relay process restarts.

 DESIGN
 ──────
 - One append-only log per room, stored on the local filesystem under
   `FRAME_LOG_DIR/<room>/`. Each frame is a length-prefixed file appended in
   arrival order; the room directory is the log.
 - Capped per room at `FRAME_LOG_MAX_BYTES` (default 64 MiB). When exceeded,
   the oldest frame files are deleted until under the cap (LRU by mtime). This
   bounds total disk usage across rooms and keeps the replay set recent; older
   frames are redundant once any client has the merged state and can re-seed via
   a full CRDT state-vector sync (handled client-side by y-websocket).
 - Also time-GC'd: frames older than `FRAME_LOG_MAX_DAYS` (default 30) are
   removed on access. Matches the client-side 30-day tombstone TTL so a device
   that has been offline ~a month still reconciles cleanly.
 - Replay is opportunistic: a new connection drains the log, then the existing
   live-forwarding path takes over. Replay happens once per connection (tracked
   via a per-conn flag) so re-sends within a session don't loop.
 - Encrypted bytes are opaque to this layer — we never decrypt, never parse, so
   the server remains ciphertext-only (the threat-model goal). We DO cap
   individual frame size (`FRAME_LOG_MAX_FRAME_BYTES`, default 16 MiB) so a
   pathological client can't exhaust disk with one giant frame.

 GATING
 ──────
 Active only when `FRAME_LOG_DIR` is set. Off by default so the fork stays
 behaviorally identical to upstream unless an operator opts in.

*/

const fs = require('fs')
const path = require('path')

const FRAME_LOG_DIR = process.env.FRAME_LOG_DIR || null
const FRAME_LOG_MAX_BYTES = parseInt(process.env.FRAME_LOG_MAX_BYTES || (64 * 1024 * 1024))
const FRAME_LOG_MAX_FRAME_BYTES = parseInt(process.env.FRAME_LOG_MAX_FRAME_BYTES || (16 * 1024 * 1024))
const FRAME_LOG_MAX_DAYS = parseFloat(process.env.FRAME_LOG_MAX_DAYS || 30)
const MS_PER_DAY = 24 * 60 * 60 * 1000

const enabled = typeof FRAME_LOG_DIR === 'string' && FRAME_LOG_DIR.length > 0
if (enabled) {
  try { fs.mkdirSync(FRAME_LOG_DIR, { recursive: true }) } catch (e) { /* may already exist */ }
  console.info(`[frameLog] persisting encrypted frames under "${FRAME_LOG_DIR}" (cap ${FRAME_LOG_MAX_BYTES} bytes/room, ttl ${FRAME_LOG_MAX_DAYS}d)`)
}

exports.frameLogEnabled = () => enabled

function roomDir (room) {
  // Sanitize room name to a single path segment (rooms are opaque hex ids, but
  // defend against anything surprising). Replace anything non-[A-Za-z0-9._-].
  const safe = String(room).replace(/[^A-Za-z0-9._-]/g, '_')
  return path.join(FRAME_LOG_DIR, safe)
}

/**
 * Append a raw encrypted frame to the room's log. No-op if disabled. Silently
 * rejects oversized frames. Triggers an LRU sweep when the room exceeds its cap.
 *
 * @param {string} room
 * @param {Uint8Array} frame  the full wire message including the 0x10 type byte
 */
function appendFrame (room, frame) {
  if (!enabled) return
  const len = frame.byteLength
  if (len === 0 || len > FRAME_LOG_MAX_FRAME_BYTES) return

  const dir = roomDir(room)
  try { fs.mkdirSync(dir, { recursive: true }) } catch (e) { /* ignore */ }

  // Length-prefixed filename: zero-padded ms timestamp + monotonic counter so
  // replay reads in arrival order via lexicographic sort.
  const seq = `${Date.now()}-${process.hrtime.bigint().toString(36)}`
  const file = path.join(dir, `${seq}.frame`)
  try {
    fs.writeFileSync(file, Buffer.from(frame.buffer, frame.byteOffset, len))
  } catch (e) {
    console.warn(`[frameLog] append failed for room ${room}: ${e.message}`)
    return
  }
  // Best-effort cap enforcement. Non-fatal if it fails.
  try { enforceCap(dir) } catch (e) { /* ignore */ }
}

/**
 * Return all stored frames for a room in arrival order, GC'ing expired ones.
 * Returns [] if disabled or the room has no log.
 *
 * @param {string} room
 * @returns {Uint8Array[]}
 */
function readFrames (room) {
  if (!enabled) return []
  const dir = roomDir(room)
  let files
  try { files = fs.readdirSync(dir) } catch (e) { return [] }

  const cutoff = Date.now() - FRAME_LOG_MAX_DAYS * MS_PER_DAY
  const frames = []
  // Lexicographic order on the zero-padded timestamp prefix == arrival order.
  for (const name of files.sort()) {
    if (!name.endsWith('.frame')) continue
    const full = path.join(dir, name)
    try {
      const st = fs.statSync(full)
      if (st.mtimeMs < cutoff) {
        fs.unlinkSync(full) // expired
        continue
      }
      const buf = fs.readFileSync(full)
      frames.push(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength))
    } catch (e) {
      // A vanished/unreadable file between readdir and read — skip it.
    }
  }
  return frames
}

/**
 * Enforce the per-room byte cap by deleting the oldest frames until under cap.
 * Uses mtime (oldest first). Called after each append.
 */
function enforceCap (dir) {
  let files
  try { files = fs.readdirSync(dir) } catch (e) { return }
  const entries = []
  let total = 0
  for (const name of files) {
    if (!name.endsWith('.frame')) continue
    const full = path.join(dir, name)
    try {
      const st = fs.statSync(full)
      entries.push({ full, mtimeMs: st.mtimeMs, size: st.size })
      total += st.size
    } catch (e) { /* skip */ }
  }
  if (total <= FRAME_LOG_MAX_BYTES) return
  // Oldest first.
  entries.sort((a, b) => a.mtimeMs - b.mtimeMs)
  for (const e of entries) {
    if (total <= FRAME_LOG_MAX_BYTES) break
    try { fs.unlinkSync(e.full); total -= e.size } catch (err) { /* ignore */ }
  }
}

exports.appendFrame = appendFrame
exports.readFrames = readFrames

// --- test hooks -------------------------------------------------------------
exports._test = {
  roomDir,
  enforceCap,
  _setEnabled: (v) => { /* read-only via env in production; tests set dir via env */ },
}
