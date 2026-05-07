import { describe, it, expect, beforeAll } from "vitest";

describe("jsdom check", () => {
  it("check window keys", () => {
    const proto = Object.getPrototypeOf(window.localStorage);
    console.log("localStorage proto:", proto);
    console.log("localStorage keys:", Object.getOwnPropertyNames(window.localStorage));
    console.log("Storage keys:", Object.getOwnPropertyNames(Storage.prototype));
    expect(typeof Storage.prototype.setItem).toBe("function");
  });
});
