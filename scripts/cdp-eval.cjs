#!/usr/bin/env node
/**
 * Minimal CDP-over-ADB driver: evaluates a JS expression in the live Incrementum
 * Android WebView (debug build) and prints the result. Used to verify the
 * podcast word-synced-transcript feature end-to-end on the device.
 *
 * Usage: node scripts/cdp-eval.cjs '<js expression returning JSON-stringifiable>'
 *
 * Expects `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`
 * to already be set up (see the verification script).
 */
const WebSocket = require("../node_modules/.pnpm/ws@8.20.0/node_modules/ws");
const http = require("http");

function getPages() {
  return new Promise((resolve, reject) => {
    http.get("http://localhost:9222/json", (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const pages = JSON.parse(data);
          const page = pages.find((p) => p.type === "page");
          resolve(page);
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function cdpCall(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const onMsg = (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.id === id) {
        ws.off("message", onMsg);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.on("message", onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

(async () => {
  const expr = process.argv[2];
  if (!expr) {
    console.error("Usage: node scripts/cdp-eval.cjs '<js>'");
    process.exit(2);
  }
  const page = await getPages();
  if (!page) {
    console.error("No debuggable page found. Is the app running + adb forward set?");
    process.exit(1);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, e) => {
    ws.on("open", r);
    ws.on("error", e);
  });

  // Wrap the expression so we always get a value back (await + return).
  const wrapped = `(async () => { try { const __r = await (${expr}); return JSON.stringify({ ok: true, value: __r }); } catch (err) { return JSON.stringify({ ok: false, error: (err && err.message) ? err.message : String(err) }); } })()`;
  const res = await cdpCall(ws, "Runtime.evaluate", {
    expression: wrapped,
    awaitPromise: true,
    returnByValue: true,
  });
  ws.close();
  const out = res?.result?.value;
  if (out) {
    const parsed = JSON.parse(out);
    if (!parsed.ok) {
      console.error("ERROR:", parsed.error);
      process.exit(1);
    }
    console.log(JSON.stringify(parsed.value, null, 2));
  } else {
    console.error("No value returned:", JSON.stringify(res));
    process.exit(1);
  }
})().catch((e) => {
  console.error("CDP driver failed:", e.message);
  process.exit(1);
});
