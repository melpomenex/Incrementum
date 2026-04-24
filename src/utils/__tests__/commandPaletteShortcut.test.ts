import { describe, expect, it } from "vitest";
import {
  dispatchCommandPaletteOpen,
  isCommandPaletteOpenShortcut,
  isEditableShortcutTarget,
} from "../commandPaletteShortcut";

function keyboardEvent(init: Partial<KeyboardEvent> & { target?: EventTarget | null }): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...init,
  });

  Object.defineProperty(event, "target", {
    configurable: true,
    value: init.target ?? document.body,
  });

  return event;
}

describe("command palette shortcut matching", () => {
  it("matches Ctrl+K and Ctrl+P", () => {
    expect(isCommandPaletteOpenShortcut(keyboardEvent({ key: "k", ctrlKey: true }))).toBe(true);
    expect(isCommandPaletteOpenShortcut(keyboardEvent({ key: "P", ctrlKey: true }))).toBe(true);
  });

  it("matches Cmd+K and Cmd+P", () => {
    expect(isCommandPaletteOpenShortcut(keyboardEvent({ key: "k", metaKey: true }))).toBe(true);
    expect(isCommandPaletteOpenShortcut(keyboardEvent({ key: "P", metaKey: true }))).toBe(true);
  });

  it("does not depend on platform detection for Ctrl or Cmd delivery", () => {
    expect(isCommandPaletteOpenShortcut(keyboardEvent({ key: "k", metaKey: true }))).toBe(true);
    expect(isCommandPaletteOpenShortcut(keyboardEvent({ key: "k", ctrlKey: true }))).toBe(true);
    expect(isCommandPaletteOpenShortcut(keyboardEvent({ key: "k", ctrlKey: true, metaKey: true }))).toBe(true);
  });

  it("rejects shifted or alternate variants", () => {
    expect(isCommandPaletteOpenShortcut(keyboardEvent({ key: "k", ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isCommandPaletteOpenShortcut(keyboardEvent({ key: "k", ctrlKey: true, altKey: true }))).toBe(false);
  });

  it("rejects editable targets", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");

    expect(isEditableShortcutTarget(input)).toBe(true);
    expect(isEditableShortcutTarget(textarea)).toBe(true);
    expect(isEditableShortcutTarget(select)).toBe(true);
    expect(isEditableShortcutTarget(editable)).toBe(true);
    expect(isCommandPaletteOpenShortcut(keyboardEvent({ key: "k", ctrlKey: true, target: input }))).toBe(false);
  });

  it("dispatches the shared command-palette-open event", () => {
    let opened = false;
    const listener = () => {
      opened = true;
    };

    window.addEventListener("command-palette-open", listener);
    dispatchCommandPaletteOpen();
    window.removeEventListener("command-palette-open", listener);

    expect(opened).toBe(true);
  });
});
