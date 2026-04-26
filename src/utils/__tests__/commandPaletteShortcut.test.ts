import { describe, expect, it } from "vitest";
import {
  dispatchCommandPaletteOpenFromNativeShortcut,
  dispatchCommandPaletteOpen,
  isCommandPaletteOpenShortcut,
  isEditableShortcutTarget,
  isCommandPaletteNativeShortcutCode,
  shouldOpenCommandPaletteFromNativeShortcut,
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

  it("matches native command palette shortcut payloads", () => {
    expect(isCommandPaletteNativeShortcutCode("KeyK")).toBe(true);
    expect(isCommandPaletteNativeShortcutCode("KeyP")).toBe(true);
    expect(isCommandPaletteNativeShortcutCode("KeyQ")).toBe(false);
  });

  it("opens from native command palette shortcuts unless an editable field is focused", () => {
    const input = document.createElement("input");

    expect(shouldOpenCommandPaletteFromNativeShortcut("KeyK", document.body)).toBe(true);
    expect(shouldOpenCommandPaletteFromNativeShortcut("KeyP", document.body)).toBe(true);
    expect(shouldOpenCommandPaletteFromNativeShortcut("KeyK", input)).toBe(false);
    expect(shouldOpenCommandPaletteFromNativeShortcut("KeyQ", document.body)).toBe(false);
  });

  it("dispatches the shared open event from native command palette shortcuts", () => {
    let opened = false;
    const listener = () => {
      opened = true;
    };

    window.addEventListener("command-palette-open", listener);
    const dispatched = dispatchCommandPaletteOpenFromNativeShortcut("KeyK", document.body);
    window.removeEventListener("command-palette-open", listener);

    expect(dispatched).toBe(true);
    expect(opened).toBe(true);
  });

  it("does not dispatch native command palette shortcuts from editable targets", () => {
    const input = document.createElement("input");
    let opened = false;
    const listener = () => {
      opened = true;
    };

    window.addEventListener("command-palette-open", listener);
    const dispatched = dispatchCommandPaletteOpenFromNativeShortcut("KeyK", input);
    window.removeEventListener("command-palette-open", listener);

    expect(dispatched).toBe(false);
    expect(opened).toBe(false);
  });
});
