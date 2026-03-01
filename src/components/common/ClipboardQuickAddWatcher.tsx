import { useEffect, useRef, useState } from "react";
import { createDocument, getDocuments } from "../../api/documents";
import { createExtract } from "../../api/extracts";
import { createLearningItem } from "../../api/learning-items";
import { useToast } from "./Toast";

const ENABLED_KEY = "incrementum.clipboardWatcher.enabled";
const POLL_MS = 1400;

async function ensureClipboardInboxDocument(): Promise<string> {
  const docs = await getDocuments();
  const existing = docs.find((doc) => doc.filePath === "clipboard://inbox" || doc.title === "Clipboard Inbox");
  if (existing) return existing.id;
  const created = await createDocument("Clipboard Inbox", "clipboard://inbox", "markdown");
  return created.id;
}

export function setClipboardWatcherEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
}

export function getClipboardWatcherEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === "1";
}

export function ClipboardQuickAddWatcher() {
  const [capturedText, setCapturedText] = useState<string | null>(null);
  const lastClipboardRef = useRef("");
  const dismissedRef = useRef(new Set<string>());
  const toast = useToast();

  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      if (!getClipboardWatcherEnabled()) return;
      if (!navigator.clipboard?.readText) return;

      try {
        const text = (await navigator.clipboard.readText()).trim();
        if (!text || text.length < 8) return;
        if (text === lastClipboardRef.current) return;
        lastClipboardRef.current = text;
        if (dismissedRef.current.has(text)) return;
        setCapturedText(text);
      } catch {
        // Clipboard permissions can fail silently.
      }
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, []);

  if (!capturedText) return null;

  const preview = capturedText.length > 140 ? `${capturedText.slice(0, 140)}...` : capturedText;

  return (
    <div className="fixed bottom-4 left-4 z-[120] w-[min(420px,calc(100vw-2rem))] rounded-lg border border-border bg-card p-3 shadow-2xl">
      <p className="text-xs font-semibold text-foreground">Clipboard quick add</p>
      <p className="mt-1 text-xs text-muted-foreground">{preview}</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          className="rounded bg-primary px-2.5 py-1.5 text-xs text-primary-foreground"
          onClick={async () => {
            await createLearningItem({
              item_type: "flashcard",
              question: capturedText,
              answer: "",
              allow_duplicate: true,
            });
            toast.success("Card created", "Clipboard text saved as a flashcard.");
            setCapturedText(null);
          }}
        >
          Create Card
        </button>
        <button
          className="rounded border border-border px-2.5 py-1.5 text-xs text-foreground"
          onClick={async () => {
            const docId = await ensureClipboardInboxDocument();
            await createExtract({ document_id: docId, content: capturedText, tags: ["clipboard"] });
            toast.success("Extract created", "Clipboard text saved as an extract.");
            setCapturedText(null);
          }}
        >
          Create Extract
        </button>
        <button
          className="rounded border border-border px-2.5 py-1.5 text-xs text-muted-foreground"
          onClick={() => {
            dismissedRef.current.add(capturedText);
            setCapturedText(null);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
