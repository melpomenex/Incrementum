#!/usr/bin/env node

/**

 Entry point for the forked y-websocket relay. Identical to upstream
 `y-websocket/bin/server.js` except it requires our local `./utils.js`
 (which adds opaque-forwarding for unknown message types — see the header
 in that file).

*/

const WebSocket = require('ws')
const http = require('http')
const wss = new WebSocket.Server({ noServer: true })
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
