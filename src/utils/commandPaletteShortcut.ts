type KeyboardShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey" | "target"
>;

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!target || !("tagName" in target)) {
    return false;
  }

  const element = target as HTMLElement;
  const contentEditable = element.getAttribute("contenteditable");
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable ||
    contentEditable === "" ||
    contentEditable === "true"
  );
}

export function isCommandPaletteOpenShortcut(
  event: KeyboardShortcutEvent
): boolean {
  if (event.altKey || event.shiftKey) {
    return false;
  }

  if (isEditableShortcutTarget(event.target)) {
    return false;
  }

  const key = event.key.toLowerCase();
  if (key !== "k" && key !== "p") {
    return false;
  }

  return event.ctrlKey || event.metaKey;
}

export function isCommandPaletteNativeShortcutCode(code: string): boolean {
  return code === "KeyK" || code === "KeyP";
}

export function shouldOpenCommandPaletteFromNativeShortcut(
  code: string,
  activeTarget: EventTarget | null = document.activeElement
): boolean {
  if (!isCommandPaletteNativeShortcutCode(code)) {
    return false;
  }

  return !isEditableShortcutTarget(activeTarget);
}

export function dispatchCommandPaletteOpen(): void {
  window.dispatchEvent(new CustomEvent("command-palette-open"));
}

export function dispatchCommandPaletteOpenFromNativeShortcut(
  code: string,
  activeTarget: EventTarget | null = document.activeElement
): boolean {
  if (!shouldOpenCommandPaletteFromNativeShortcut(code, activeTarget)) {
    return false;
  }

  dispatchCommandPaletteOpen();
  return true;
}
