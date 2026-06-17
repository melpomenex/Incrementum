/**
 * Vitest setup file
 * Runs before each test file
 */

import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { vi } from "vitest";

// Node.js v25+ ships a native `localStorage`/`sessionStorage` global whose
// backing object lacks the Storage prototype — `.setItem`/`.getItem`/`.clear`
// are all `undefined`, so every test that touches storage fails. jsdom provides
// a working `Storage` constructor + prototype, but Node's broken instance
// shadows it and jsdom's `populateGlobal` cannot overwrite a non-configurable
// Node global. Replace `Storage.prototype`'s methods with spec-conformant
// implementations backed by an instance-local Map, then install fresh instances
// (inheriting from that prototype) over Node's broken globals. Keeping the
// methods on the prototype (not as own props) ensures `vi.spyOn(Storage.prototype,
// "setItem")` continues to intercept writes.
// See https://github.com/vitest-dev/vitest/issues/8757
const backing = Symbol("backing");
interface ShimStorage extends Storage {
  [backing]: Map<string, string>;
}
Object.defineProperties(Storage.prototype, {
  length: { configurable: true, get() { return (this as ShimStorage)[backing].size; } },
  clear: { configurable: true, value() { (this as ShimStorage)[backing].clear(); } },
  getItem: {
    configurable: true,
    value(key: string) {
      const m = (this as ShimStorage)[backing];
      return m.has(key) ? m.get(key)! : null;
    },
  },
  key: {
    configurable: true,
    value(index: number) {
      return Array.from((this as ShimStorage)[backing].keys())[index] ?? null;
    },
  },
  removeItem: { configurable: true, value(key: string) { (this as ShimStorage)[backing].delete(key); } },
  setItem: {
    configurable: true,
    value(key: string, value: string) {
      (this as ShimStorage)[backing].set(key, String(value));
    },
  },
});
function createStorage(): Storage {
  const store = Object.create(Storage.prototype) as ShimStorage;
  store[backing] = new Map<string, string>();
  return store;
}
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: createStorage(),
});
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: createStorage(),
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => path),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
  listen: vi.fn(() => Promise.resolve({ unregister: vi.fn() })),
}));

// Mock PDF.js for test environment to avoid DOMMatrix dependency.
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 0,
      getPage: vi.fn(),
    }),
  })),
}));

// Mock window.__TAURI__ for Tauri 2.0
Object.defineProperty(window, "__TAURI__", {
  value: {
    core: {
      invoke: vi.fn(),
    },
    event: {
      emit: vi.fn(),
      listen: vi.fn(() => Promise.resolve({ unregister: vi.fn() })),
    },
  },
  writable: true,
});

// Mock matchMedia for components relying on PWA/media queries.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// Suppress console errors in tests (optional, for cleaner output)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Warning: ReactDOM.render")
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
