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

export function isMacPlatform(platform = navigator.platform): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

export function isCommandPaletteOpenShortcut(
  event: KeyboardShortcutEvent,
  platform = navigator.platform
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

  if (isMacPlatform(platform)) {
    return event.metaKey && !event.ctrlKey;
  }

  return event.ctrlKey && !event.metaKey;
}

export function dispatchCommandPaletteOpen(): void {
  window.dispatchEvent(new CustomEvent("command-palette-open"));
}
