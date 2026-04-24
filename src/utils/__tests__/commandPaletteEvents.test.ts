import { describe, expect, it } from "vitest";
import { registerCommandPaletteOpenEvents } from "../commandPaletteEvents";

describe("command palette event binding", () => {
  it("opens the command palette from the shared open event", () => {
    let open = false;
    const cleanup = registerCommandPaletteOpenEvents(
      (nextOpen) => {
        open = nextOpen;
      },
      () => open
    );

    window.dispatchEvent(new CustomEvent("command-palette-open"));
    cleanup();

    expect(open).toBe(true);
  });

  it("toggles using the current command palette state", () => {
    let open = false;
    const cleanup = registerCommandPaletteOpenEvents(
      (nextOpen) => {
        open = nextOpen;
      },
      () => open
    );

    window.dispatchEvent(new CustomEvent("command-palette-toggle"));
    expect(open).toBe(true);

    window.dispatchEvent(new CustomEvent("command-palette-toggle"));
    cleanup();

    expect(open).toBe(false);
  });

  it("removes listeners during cleanup", () => {
    let open = false;
    const cleanup = registerCommandPaletteOpenEvents(
      (nextOpen) => {
        open = nextOpen;
      },
      () => open
    );

    cleanup();
    window.dispatchEvent(new CustomEvent("command-palette-open"));

    expect(open).toBe(false);
  });
});
