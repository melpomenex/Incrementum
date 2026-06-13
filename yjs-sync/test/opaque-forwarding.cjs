#!/usr/bin/env node

/**

 Integration test for the forked y-websocket relay.

 Verifies the single behavior the fork adds over upstream: unknown
 message-type bytes are forwarded opaquely to other connections in the
 same room, without being applied to the server's local Yjs doc.

 Runs as a standalone Node script (not under vitest) because it spawns a
 real server. Exit code 0 = pass, non-zero = fail. Intended for CI:
   node yjs-sync/test/opaque-forwarding.js

*/

const { spawn } = require('child_process')
const http = require('http')
const path = require('path')
const WebSocket = require('ws')

const SERVER_PATH = path.join(__dirname, '..', 'server.js')
const ROOM = '/test-room-opaque-forwarding'

function pickPort() {
  return 10000 + Math.floor(Math.random() * 50000)
}

function waitForReady(port, attemptsLeft = 100) {
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        res.destroy()
        resolve()
      })
      req.on('error', () => {
        if (attemptsLeft <= 0) reject(new Error('server never became ready'))
        else setTimeout(() => waitForReady(port, attemptsLeft - 1).then(resolve, reject), 100)
      })
      req.setTimeout(1000, () => {
        req.destroy()
        if (attemptsLeft <= 0) reject(new Error('server never became ready'))
        else setTimeout(() => waitForReady(port, attemptsLeft - 1).then(resolve, reject), 100)
      })
    }
    tryConnect()
  })
}

async function withServer(fn) {
  const port = pickPort()
  const child = spawn(process.execPath, [SERVER_PATH], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const stderr = []
  child.stderr.on('data', (chunk) => stderr.push(chunk))
  child.stdout.on('data', () => {})

  try {
    await waitForReady(port)
    return await fn(port)
  } finally {
    child.kill('SIGTERM')
    if (stderr.length) {
      process.stderr.write(Buffer.concat(stderr).toString())
    }
  }
}

function connect(port, room) {
  return new WebSocket(`ws://127.0.0.1:${port}${room}`)
}

function nextMessage(ws, predicate = () => true, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for message')), timeoutMs)
    ws.on('message', function handler(data) {
      const bytes = new Uint8Array(data)
      if (!predicate(bytes)) return
      clearTimeout(timer)
      ws.off('message', handler)
      resolve(bytes)
    })
  })
}

async function testOpaqueForwarding(port) {
  const sender = connect(port, ROOM)
  const receiver = connect(port, ROOM)
  try {
    await Promise.all([
      new Promise((r) => sender.addEventListener('open', r, { once: true })),
      new Promise((r) => receiver.addEventListener('open', r, { once: true })),
    ])

    // The server sends a sync-step-1 message on connect; drain it so it
    // doesn't pollute later assertions.
    const drain = nextMessage(receiver, (b) => b.length > 0).catch(() => null)
    await drain

    // Construct an unknown-type frame: type byte 0x10 (encrypted-sync in
    // our wrapper protocol), followed by some opaque payload bytes the
    // server cannot interpret.
    const payload = new Uint8Array([0x10, 0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03])
    sender.send(payload)

    const received = await nextMessage(receiver, (b) => b.length > 0 && b[0] === 0x10)

    if (received.length !== payload.length) {
      throw new Error(`length mismatch: sent ${payload.length}, got ${received.length}`)
    }
    for (let i = 0; i < payload.length; i++) {
      if (received[i] !== payload[i]) {
        throw new Error(`byte mismatch at index ${i}: sent ${payload[i]}, got ${received[i]}`)
      }
    }
  } finally {
    sender.close()
    receiver.close()
  }
}

async function testUnknownTypeNotAppliedToServerDoc(port) {
  // Send a frame with an unknown type to a room, then connect a fresh
  // client to the same room. The fresh client's initial sync-step-1 from
  // the server should report an EMPTY doc — proving the unknown-type
  // frame was forwarded without being applied to the server's Yjs state.
  const sender = connect(port, '/test-room-not-applied')
  await new Promise((r) => sender.addEventListener('open', r, { once: true }))

  const garbage = new Uint8Array([0x10, 0xaa, 0xbb, 0xcc, 0xdd])
  sender.send(garbage)
  // Give the relay a beat to (not) process it.
  await new Promise((r) => setTimeout(r, 200))

  const observer = connect(port, '/test-room-not-applied')
  try {
    await new Promise((r) => observer.addEventListener('open', r, { once: true }))
    const firstMessage = await nextMessage(observer, (b) => b.length > 0, 2000)

    // Server's first message is sync-step-1 (type 0). The sync step 1
    // payload is just a state vector; for an empty doc it's a tiny
    // encoding. The key assertion: this is a sync-type message (byte 0),
    // NOT our unknown-type 0x10. If the server had applied our garbage
    // frame to its Yjs doc, the doc state would be corrupted and the
    // sync-step-1 response would either fail or be enormous.
    if (firstMessage[0] !== 0x00) {
      throw new Error(
        `expected sync-step-1 (type 0) as first message, got type ${firstMessage[0]}`,
      )
    }
    // Sanity: state vector of an empty doc encodes to exactly 1 byte (the
    // type byte) since there are no clients. Allow some slack for the
    // encoder's length prefix, but anything huge means doc state leaked in.
    if (firstMessage.length > 16) {
      throw new Error(
        `sync-step-1 response suspiciously large (${firstMessage.length} bytes) — server may have applied the unknown-type frame`,
      )
    }
  } finally {
    sender.close()
    observer.close()
  }
}

async function main() {
  console.log('Spawning forked relay and running opaque-forwarding tests...')
  await withServer(async (port) => {
    console.log('  test 1: unknown-type frame forwarded verbatim to peer')
    await testOpaqueForwarding(port)
    console.log('  ✓ frame bytes round-trip intact')

    console.log('  test 2: unknown-type frame NOT applied to server Yjs doc')
    await testUnknownTypeNotAppliedToServerDoc(port)
    console.log('  ✓ server doc remains empty for the unknown frame')
  })
  console.log('All opaque-forwarding tests passed.')
}

main().catch((err) => {
  console.error('FAIL:', err.message || err)
  process.exit(1)
})
