#!/usr/bin/env node

/**

 Entry point for the forked y-websocket relay. Identical to upstream
 `y-websocket/bin/server.js` except it requires our local `./utils.js`
 (which adds opaque-forwarding for unknown message types — see the header
 in that file).

*/

const WebSocket = require('ws')
const http = require('http')
// Set an explicit, generous max payload. The `ws` default is large but not
// infinite, and a Yjs room that has accumulated CRDT history (deleted entries
// live on as tombstones) can produce sync updates of several MB — e.g. stale
// base64 cover-image values pushed through the localStorage-sync layer. An
// oversized frame would otherwise close the connection with 1009
// MESSAGE_TOO_BIG, which y-websocket surfaces as an endless reconnect loop
// and silently breaks replication. 256 MiB comfortably bounds any plausible
// sync exchange while still rejecting genuinely pathological frames.
const MAX_PAYLOAD_BYTES = 256 * 1024 * 1024
const wss = new WebSocket.Server({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES })
const setupWSConnection = require('./utils.js').setupWSConnection

const host = process.env.HOST || 'localhost'
const port = process.env.PORT || 1234

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('okay')
})

wss.on('connection', setupWSConnection)

server.on('upgrade', (request, socket, head) => {
  const handleAuth = ws => {
    wss.emit('connection', ws, request)
  }
  wss.handleUpgrade(request, socket, head, handleAuth)
})

server.listen(port, host, () => {
  console.log(`forked y-websocket relay running at '${host}' on port ${port}`)
})
