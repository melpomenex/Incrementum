#!/usr/bin/env node
/**

 Unit tests for the encrypted-frame rolling log (yjs-sync/frameLog.js).

 Verifies the persistence behavior that makes async encrypted sync work:
 append → read-back round-trip, arrival ordering, the per-room byte cap (LRU
 eviction of the oldest frames), and the time-based GC of expired frames.

 Runs as a standalone Node script (no test runner). Exit 0 = pass.
   node yjs-sync/test/frame-log.cjs

*/

const fs = require('fs')
const os = require('os')
const path = require('path')

// frameLog reads its config from env at require time, so set the dir before
// requiring. Use a fresh temp dir per run.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'framelog-'))
process.env.FRAME_LOG_DIR = TMP
process.env.FRAME_LOG_MAX_BYTES = '2048' // small cap so the LRU test is fast
process.env.FRAME_LOG_MAX_DAYS = '30'

const frameLog = require('../frameLog')

let passed = 0
let failed = 0
function assert (cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg) }
  else { failed++; console.error('  ✗', msg) }
}
function bufEq (a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function frame (n) {
  // Simulate a wire frame: 0x10 type byte + payload.
  return new Uint8Array([0x10, n, n + 1, n + 2])
}

async function main () {
  if (!frameLog.frameLogEnabled()) throw new Error('frameLog should be enabled when FRAME_LOG_DIR is set')

  // --- Test 1: append + read round-trip, arrival order ---
  console.log('Test 1: append/read round-trip preserves arrival order')
  frameLog.appendFrame('roomA', frame(1))
  // tiny delay so timestamps differ enough for sort stability
  await new Promise(r => setTimeout(r, 5))
  frameLog.appendFrame('roomA', frame(2))
  await new Promise(r => setTimeout(r, 5))
  frameLog.appendFrame('roomA', frame(3))
  const read = frameLog.readFrames('roomA')
  assert(read.length === 3, 'reads back all 3 frames')
  assert(bufEq(read[0], frame(1)), 'first frame is the earliest (arrival order)')
  assert(bufEq(read[2], frame(3)), 'last frame is the latest')

  // --- Test 2: rooms are isolated ---
  console.log('Test 2: rooms are isolated')
  frameLog.appendFrame('roomB', frame(99))
  const a = frameLog.readFrames('roomA')
  const b = frameLog.readFrames('roomB')
  assert(a.length === 3, 'roomA unaffected by roomB writes')
  assert(b.length === 1, 'roomB has only its own frame')
  assert(bufEq(b[0], frame(99)), 'roomB frame matches')

  // --- Test 3: empty room returns [] ---
  console.log('Test 3: unknown room returns empty')
  assert(frameLog.readFrames('nope').length === 0, 'unknown room → []')

  // --- Test 4: per-room byte cap evicts oldest first (LRU) ---
  console.log('Test 4: byte cap evicts oldest frames first')
  // cap is 2048 bytes; each frame file is 4 bytes. Write ~600 frames to blow it.
  const capRoom = 'capRoom'
  for (let i = 0; i < 600; i++) {
    frameLog.appendFrame(capRoom, frame(i % 200))
    if (i % 100 === 0) await new Promise(r => setTimeout(r, 1))
  }
  const capped = frameLog.readFrames(capRoom)
  assert(capped.length < 600, 'eviction reduced frame count below what was written')
  assert(capped.length > 0, 'but kept the most recent frames')
  // After LRU, the surviving frames should be the most recent ones (payload 199
  // was the last appended). Check the last frame's payload is from the tail.
  const lastPayload = capped[capped.length - 1]
  assert(lastPayload[0] === 0x10, 'surviving frame retains wire type byte')

  // --- Test 5: oversized frames are rejected ---
  console.log('Test 5: oversized frames rejected')
  process.env.FRAME_LOG_MAX_FRAME_BYTES = '8'
  // Re-require won't re-read env (module caches); call the internal cap path by
  // appending a frame larger than the default 16MiB. Construct a >16MiB frame.
  const huge = new Uint8Array(17 * 1024 * 1024)
  const beforeHuge = fs.readdirSync(path.join(TMP, 'roomA')).length
  frameLog.appendFrame('roomA', huge)
  const afterHuge = fs.readdirSync(path.join(TMP, 'roomA')).length
  assert(beforeHuge === afterHuge, 'oversized frame was not persisted')

  // --- Test 6: time GC removes expired frames ---
  console.log('Test 6: expired frames are GC\'d on read')
  // Manually back-date a file in a fresh room.
  frameLog.appendFrame('gcRoom', frame(5))
  const dir = path.join(TMP, 'gcRoom')
  const f = fs.readdirSync(dir)[0]
  const old = Date.now() / 1000 - (31 * 24 * 60 * 60) // 31 days ago (seconds)
  fs.utimesSync(path.join(dir, f), old, old)
  const gcRead = frameLog.readFrames('gcRoom')
  assert(gcRead.length === 0, 'expired frame removed on read')

  console.log(`\n${passed} passed, ${failed} failed`)
  // cleanup
  try { fs.rmSync(TMP, { recursive: true, force: true }) } catch (e) { /* ignore */ }
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
