import { describe, expect, it } from "vitest";
import { installPromiseCompat } from "../promiseCompat";

type PromiseCompat = PromiseConstructor & {
  try?: <T>(fn: (...args: unknown[]) => T | PromiseLike<T>, ...args: unknown[]) => Promise<T>;
  withResolvers?: <T>() => {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  };
};

describe("installPromiseCompat", () => {
  it("restores Promise.try and Promise.withResolvers for older WebView-like environments", async () => {
    const fakeGlobal = {
      Promise: Promise,
    } as typeof globalThis;
    const promiseCtor = fakeGlobal.Promise as PromiseCompat;

    delete promiseCtor.try;
    delete promiseCtor.withResolvers;

    installPromiseCompat(fakeGlobal);

    expect(typeof promiseCtor.try).toBe("function");
    expect(typeof promiseCtor.withResolvers).toBe("function");

    await expect(promiseCtor.try?.(() => "pdf-import-ok")).resolves.toBe("pdf-import-ok");

    const resolvers = promiseCtor.withResolvers?.<string>();
    expect(resolvers).toBeDefined();
    resolvers?.resolve("worker-ready");
    await expect(resolvers?.promise).resolves.toBe("worker-ready");
  });
});
