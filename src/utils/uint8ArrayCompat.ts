/**
 * Polyfills for Uint8Array methods missing in older WebView2 / Chromium runtimes.
 *
 * pdfjs-dist >= 5.4 calls Uint8Array.prototype.toHex() when computing PDF
 * fingerprints (MD5 hash → hex string).  This method was added in Chromium 130 /
 * V8 13.0.  Users on Windows with an outdated Edge WebView2 runtime will hit
 *   "a.toHex is not a function"
 * unless we polyfill it.
 *
 * The implementation is taken from the pdfjs-dist legacy build's own polyfill
 * (core-js) which simply maps each byte to a two-digit hex string.
 */

export function installUint8ArrayCompat(target: typeof globalThis = globalThis): void {
  const ctor = target.Uint8Array as typeof Uint8Array & {
    prototype: typeof Uint8Array.prototype & { toHex?: () => string };
  };

  if (ctor && typeof ctor.prototype.toHex !== "function") {
    ctor.prototype.toHex = function toHex(this: Uint8Array): string {
      const len = this.length;
      const hex = new Array<string>(len);
      for (let i = 0; i < len; i++) {
        hex[i] = this[i].toString(16).padStart(2, "0");
      }
      return hex.join("");
    };
  }
}
