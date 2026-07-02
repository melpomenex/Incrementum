/**

 Fork of `y-websocket/bin/utils.js` with one change: `messageListener`'s
 switch has a `default` case that forwards unknown message-type bytes
 opaquely to other connections in the same room.

 Why this fork exists
 ────────────────────
 The stock relay only handles `messageSync` (type 0) and `messageAwareness`
 (type 1) and silently drops everything else. The encrypted-state wrapper
 (`src/lib/sync/encryptedProvider.ts`) introduces a new wire type (`0x10`)
 for AES-GCM-encrypted sync payloads. Without this fork, those frames are
 discarded at the relay and never reach peers.

 The default case does NOT apply the bytes to the server's local Yjs doc,
 does NOT trigger the doc's `update` event, and does NOT persist anything.
 Two consequences:

   1. The relay cannot decrypt, apply, or GC the encrypted state — which is
      exactly the threat-model goal (server sees ciphertext only).
   2. The relay does NOT durably store encrypted frames. If all clients in a
      room disconnect, the next client to connect will find an empty room
      from the relay's perspective. True async sync (device A uploads, device
      B downloads hours later when A is offline) requires a separate
      persistence layer on top of this forwarding — see task 1.8b in
      `openspec/changes/overhaul-cross-device-sync/tasks.md`.

 This fork tracks upstream closely so merging future y-websocket fixes is
 mechanical. The only intentional divergence is the `default` case in
 `messageListener`. Search for `FORK:` to find the change.

*/

const Y = require('yjs')
const syncProtocol = require('y-protocols/dist/sync.cjs')
const awarenessProtocol = require('y-protocols/dist/awareness.cjs')

const encoding = require('lib0/dist/encoding.cjs')
const decoding = require('lib0/dist/decoding.cjs')
const map = require('lib0/dist/map.cjs')

const debounce = require('lodash.debounce')

// Encrypted-frame rolling log (task 1.8b). Optional server-side persistence so
// async encrypted sync works (device A writes, device B downloads later when A
// is offline). Gated on FRAME_LOG_DIR; no-op when unset. See frameLog.js.
const frameLog = require('./frameLog')

// Inlined from y-websocket/bin/callback.js so this fork can run outside
// the y-websocket package directory (the upstream bin/utils.js uses a
// relative require('./callback.js') that doesn't resolve from our location,
// and y-websocket's package.json `exports` field blocks deep imports).
// Behavior is identical to upstream — only active when CALLBACK_URL is set.
const CALLBACK_URL = process.env.CALLBACK_URL ? new URL(process.env.CALLBACK_URL) : null
const CALLBACK_TIMEOUT = process.env.CALLBACK_TIMEOUT || 5000
const CALLBACK_OBJECTS = process.env.CALLBACK_OBJECTS ? JSON.parse(process.env.CALLBACK_OBJECTS) : {}
const isCallbackSet = !!CALLBACK_URL

const callbackHandler = (update, origin, doc) => {
  const room = doc.name
  const dataToSend = { room, data: {} }
  Object.keys(CALLBACK_OBJECTS).forEach((sharedObjectName) => {
    const sharedObjectType = CALLBACK_OBJECTS[sharedObjectName]
    dataToSend.data[sharedObjectName] = {
      type: sharedObjectType,
      content: getContent(sharedObjectName, sharedObjectType, doc).toJSON(),
    }
  })
  callbackRequest(CALLBACK_URL, CALLBACK_TIMEOUT, dataToSend)
}

const callbackRequest = (url, timeout, data) => {
  data = JSON.stringify(data)
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    timeout,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
  }
  const req = require('http').request(options)
  req.on('timeout', () => { req.abort() })
  req.on('error', () => { req.abort() })
  req.write(data)
  req.end()
}

const getContent = (objName, objType, doc) => {
  switch (objType) {
    case 'Array': return doc.getArray(objName)
    case 'Map': return doc.getMap(objName)
    case 'Text': return doc.getText(objName)
    case 'XmlFragment': return doc.getXmlFragment(objName)
    case 'XmlElement': return doc.getXmlElement(objName)
    default: return {}
  }
}

const CALLBACK_DEBOUNCE_WAIT = parseInt(process.env.CALLBACK_DEBOUNCE_WAIT) || 2000
const CALLBACK_DEBOUNCE_MAXWAIT = parseInt(process.env.CALLBACK_DEBOUNCE_MAXWAIT) || 10000

const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1
const wsReadyStateClosing = 2
const wsReadyStateClosed = 3

const gcEnabled = process.env.GC !== 'false' && process.env.GC !== '0'
const persistenceDir = process.env.YPERSISTENCE
let persistence = null
if (typeof persistenceDir === 'string') {
  console.info('Persisting documents to "' + persistenceDir + '"')
  const LeveldbPersistence = require('y-leveldb').LeveldbPersistence
  const ldb = new LeveldbPersistence(persistenceDir)
  persistence = {
    provider: ldb,
    bindState: async (docName, ydoc) => {
      const persistedYdoc = await ldb.getYDoc(docName)
      const newUpdates = Y.encodeStateAsUpdate(ydoc)
      ldb.storeUpdate(docName, newUpdates)
      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc))
      ydoc.on('update', update => {
        ldb.storeUpdate(docName, update)
      })
    },
    writeState: async (docName, ydoc) => {}
  }
}

exports.setPersistence = persistence_ => {
  persistence = persistence_
}

exports.getPersistence = () => persistence

const docs = new Map()
exports.docs = docs

const messageSync = 0
const messageAwareness = 1
const messageAuth = 2

const updateHandler = (update, origin, doc) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeUpdate(encoder, update)
  const message = encoding.toUint8Array(encoder)
  doc.conns.forEach((_, conn) => send(doc, conn, message))
}

class WSSharedDoc extends Y.Doc {
  constructor (name) {
    super({ gc: gcEnabled })
    this.name = name
    this.conns = new Map()
    this.awareness = new awarenessProtocol.Awareness(this)
    this.awareness.setLocalState(null)
    const awarenessChangeHandler = ({ added, updated, removed }, conn) => {
      const changedClients = added.concat(updated, removed)
      if (conn !== null) {
        const connControlledIDs = this.conns.get(conn)
        if (connControlledIDs !== undefined) {
          added.forEach(clientID => { connControlledIDs.add(clientID) })
          removed.forEach(clientID => { connControlledIDs.delete(clientID) })
        }
      }
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients))
      const buff = encoding.toUint8Array(encoder)
      this.conns.forEach((_, c) => {
        send(this, c, buff)
      })
    }
    this.awareness.on('update', awarenessChangeHandler)
    this.on('update', updateHandler)
    if (isCallbackSet) {
      this.on('update', debounce(
        callbackHandler,
        CALLBACK_DEBOUNCE_WAIT,
        { maxWait: CALLBACK_DEBOUNCE_MAXWAIT }
      ))
    }
  }
}

const getYDoc = (docname, gc = true) => map.setIfUndefined(docs, docname, () => {
  const doc = new WSSharedDoc(docname)
  doc.gc = gc
  if (persistence !== null) {
    persistence.bindState(docname, doc)
  }
  docs.set(docname, doc)
  return doc
})

exports.getYDoc = getYDoc

const messageListener = (conn, doc, message) => {
  try {
    const encoder = encoding.createEncoder()
    const decoder = decoding.createDecoder(message)
    const messageType = decoding.readVarUint(decoder)
    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync)
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn)

        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder))
        }
        break
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn)
        break
      }
      // FORK: opaque-forwarding default case. Stock y-websocket silently
      // drops unknown message-type bytes; we forward them verbatim to every
      // other connection in the same room. The bytes are NOT applied to the
      // server's Yjs doc, NOT re-encoded — clients that understand the type
      // (e.g. encrypted-sync frames) handle them; the relay stays a dumb
      // forwarder for anything it doesn't recognize.
      //
      // Persistence: the raw frame is also appended to the room's rolling
      // encrypted-frame log (frameLog.js) so a peer connecting later — after
      // every live peer has disconnected, or after a relay restart — receives
      // the backlog on connect. This is what makes async encrypted sync work
      // (device A writes at 9am, device B downloads at noon). No-op when
      // FRAME_LOG_DIR is unset.
      default: {
        doc.conns.forEach((_, c) => {
          if (c !== conn) send(doc, c, message)
        })
        try { frameLog.appendFrame(doc.name, message) } catch (e) { /* persistence is best-effort */ }
      }
    }
  } catch (err) {
    console.error(err)
    doc.emit('error', [err])
  }
}

const closeConn = (doc, conn) => {
  if (doc.conns.has(conn)) {
    const controlledIds = doc.conns.get(conn)
    doc.conns.delete(conn)
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null)
    if (doc.conns.size === 0 && persistence !== null) {
      persistence.writeState(doc.name, doc).then(() => {
        doc.destroy()
      })
      docs.delete(doc.name)
    }
  }
  conn.close()
}

const send = (doc, conn, m) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    closeConn(doc, conn)
  }
  try {
    conn.send(m, err => { err != null && closeConn(doc, conn) })
  } catch (e) {
    closeConn(doc, conn)
  }
}

const pingTimeout = 30000

exports.setupWSConnection = (conn, req, { docName = req.url.slice(1).split('?')[0], gc = true } = {}) => {
  conn.binaryType = 'arraybuffer'
  const doc = getYDoc(docName, gc)
  doc.conns.set(conn, new Set())
  conn.on('message', message => messageListener(conn, doc, new Uint8Array(message)))

  // Replay persisted encrypted frames for this room to the new connection,
  // before the standard sync-step-1 handshake below. This delivers the backlog
  // of encrypted state to a device that is joining after the writers went
  // offline — the core async-sync path. Each frame is forwarded verbatim (the
  // client's encryptedProvider decrypts). Best-effort: if the read fails or
  // the log is disabled, sync proceeds with the standard handshake only.
  try {
    if (frameLog.frameLogEnabled()) {
      const frames = frameLog.readFrames(docName)
      for (const frame of frames) {
        send(doc, conn, frame)
      }
    }
  } catch (e) {
    console.warn(`[frameLog] replay failed for room ${docName}: ${e.message}`)
  }

  let pongReceived = true
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        closeConn(doc, conn)
      }
      clearInterval(pingInterval)
    } else if (doc.conns.has(conn)) {
      pongReceived = false
      try {
        conn.ping()
      } catch (e) {
        closeConn(doc, conn)
        clearInterval(pingInterval)
      }
    }
  }, pingTimeout)
  conn.on('close', () => {
    closeConn(doc, conn)
    clearInterval(pingInterval)
  })
  conn.on('pong', () => {
    pongReceived = true
  })
  {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeSyncStep1(encoder, doc)
    send(doc, conn, encoding.toUint8Array(encoder))
    const awarenessStates = doc.awareness.getStates()
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())))
      send(doc, conn, encoding.toUint8Array(encoder))
    }
  }
}
