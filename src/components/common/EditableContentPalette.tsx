import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowSquareOut,
  ArrowUp,
  CheckCircle,
  CircleNotch,
  DotsSix,
  Eye,
  PencilLine,
  Rows,
  SidebarSimple,
  SquareSplitVertical,
  X,
} from "@phosphor-icons/react";
import { renderMarkdown } from "../../utils/markdown";
import { processHtmlContent } from "../../utils/documentImport";
import { cn } from "../../utils";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
type PaletteMode = "write" | "split" | "preview";
type ContentKind = "markdown" | "html" | "plain";

interface EditableContentPaletteProps {
  title: string;
  badge?: string;
  content: string;
  notes?: string;
  contentKind?: ContentKind;
  sourceUrl?: string;
  placeholder?: string;
  notesPlaceholder?: string;
  emptyPreviewMessage?: string;
  onSave: (payload: { content: string; notes?: string }) => Promise<void>;
  onSelectionChange?: (text: string) => void;
  onClose?: () => void;
}

interface ImageEntry {
  alt: string;
  src: string;
  token: string;
  start: number;
  end: number;
}

const IMAGE_MARKDOWN_RE = /!\[(.*?)\]\((.+?)(?:\s+"(.*?)")?\)/g;
const IMAGE_HTML_RE = /<img\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;

function extractImages(content: string): ImageEntry[] {
  const images: ImageEntry[] = [];
  let match: RegExpExecArray | null;

  IMAGE_MARKDOWN_RE.lastIndex = 0;
  while ((match = IMAGE_MARKDOWN_RE.exec(content)) !== null) {
    images.push({
      alt: match[1] ?? "",
      src: match[2] ?? "",
      token: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  IMAGE_HTML_RE.lastIndex = 0;
  while ((match = IMAGE_HTML_RE.exec(content)) !== null) {
    images.push({
      alt: "",
      src: match[1] ?? "",
      token: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return images.sort((a, b) => a.start - b.start);
}

function moveImageToken(content: string, images: ImageEntry[], index: number, direction: -1 | 1): string {
  const swapIndex = index + direction;
  if (swapIndex < 0 || swapIndex >= images.length) return content;

  const firstIndex = Math.min(index, swapIndex);
  const secondIndex = Math.max(index, swapIndex);
  const first = images[firstIndex];
  const second = images[secondIndex];

  const before = content.slice(0, first.start);
  const between = content.slice(first.end, second.start);
  const after = content.slice(second.end);

  return `${before}${second.token}${between}${first.token}${after}`;
}

export function EditableContentPalette({
  title,
  badge,
  content,
  notes,
  contentKind = "markdown",
  sourceUrl,
  placeholder = "Start editing...",
  notesPlaceholder = "Add notes...",
  emptyPreviewMessage = "Nothing to preview yet.",
  onSave,
  onSelectionChange,
  onClose,
}: EditableContentPaletteProps) {
  const [draftContent, setDraftContent] = useState(content);
  const [draftNotes, setDraftNotes] = useState(notes ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("split");
  const lastSavedRef = useRef({ content, notes: notes ?? "" });
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const previewRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const nextNotes = notes ?? "";
    setDraftContent(content);
    setDraftNotes(nextNotes);
    lastSavedRef.current = { content, notes: nextNotes };
    setSaveStatus("idle");
  }, [content, notes, title]);

  useEffect(() => {
    if (
      draftContent === lastSavedRef.current.content
      && draftNotes === lastSavedRef.current.notes
    ) {
      return;
    }

    setSaveStatus("dirty");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await onSave({
          content: draftContent,
          notes: notes !== undefined ? draftNotes : undefined,
        });
        if (!isMountedRef.current) return;
        lastSavedRef.current = { content: draftContent, notes: draftNotes };
        setSaveStatus("saved");
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setSaveStatus("idle");
        }, 1600);
      } catch (error) {
        console.error("Failed to save editable palette:", error);
        if (!isMountedRef.current) return;
        setSaveStatus("error");
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [draftContent, draftNotes, notes, onSave]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
  }, []);

  // Propagate text selection from the preview pane to the parent
  useEffect(() => {
    if (!onSelectionChange) return;
    if (paletteMode === "write") return;

    const el = previewRef.current;
    if (!el) return;

    // Handler for markdown preview (same-document selection)
    const handleDocSelectionChange = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (text && el.contains(sel?.anchorNode)) {
        onSelectionChange(text);
      } else {
        onSelectionChange("");
      }
    };

    document.addEventListener("selectionchange", handleDocSelectionChange);

    // For HTML content rendered in an iframe, selection events fire on the iframe's document
    let iframeCleanup: (() => void) | null = null;
    if (contentKind === "html") {
      const iframe = iframeRef.current;
      if (iframe) {
        const attachIframeListener = () => {
          try {
            const iframeDoc = iframe.contentDocument;
            if (!iframeDoc) return;
            const handleIframeSelectionChange = () => {
              try {
                const sel = iframe.contentWindow?.getSelection();
                const text = sel?.toString().trim() ?? "";
                onSelectionChange(text);
              } catch { /* cross-origin guard */ }
            };
            iframeDoc.addEventListener("selectionchange", handleIframeSelectionChange);
            iframeCleanup = () => {
              try {
                iframeDoc.removeEventListener("selectionchange", handleIframeSelectionChange);
              } catch { /* iframe may be gone */ }
            };
          } catch { /* cross-origin guard */ }
        };

        // If iframe is already loaded, attach immediately
        if (iframe.contentDocument?.readyState === "complete") {
          attachIframeListener();
        }
        iframe.addEventListener("load", attachIframeListener);
        const origCleanup = iframeCleanup;
        iframeCleanup = () => {
          iframe.removeEventListener("load", attachIframeListener);
          origCleanup?.();
        };
      }
    }

    return () => {
      document.removeEventListener("selectionchange", handleDocSelectionChange);
      iframeCleanup?.();
      onSelectionChange("");
    };
  }, [paletteMode, onSelectionChange, contentKind]);

  const images = useMemo(() => extractImages(draftContent), [draftContent]);

  const previewHtml = useMemo(() => {
    if (!draftContent.trim()) return "";
    if (contentKind === "html") {
      return processHtmlContent(draftContent, sourceUrl ?? window.location.origin, title, true);
    }
    if (contentKind === "plain") {
      return renderMarkdown(draftContent.replace(/\n/g, "  \n"));
    }
    return renderMarkdown(draftContent);
  }, [contentKind, draftContent, sourceUrl, title]);

  const renderStatus = () => {
    if (saveStatus === "saving") {
      return (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircleNotch className="w-3.5 h-3.5 animate-spin" />
          Saving
        </span>
      );
    }
    if (saveStatus === "saved") {
      return (
        <span className="flex items-center gap-2 text-xs text-emerald-500">
          <CheckCircle className="w-3.5 h-3.5" />
          Saved
        </span>
      );
    }
    if (saveStatus === "error") {
      return (
        <span className="flex items-center gap-2 text-xs text-red-500">
          <X className="w-3.5 h-3.5" />
          Save failed
        </span>
      );
    }
    if (saveStatus === "dirty") {
      return (
        <span className="flex items-center gap-2 text-xs text-amber-500">
          <PencilLine className="w-3.5 h-3.5" />
          Unsaved
        </span>
      );
    }
    return null;
  };

  return (
    <div className="h-full min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_22%)]">
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {badge && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <SidebarSimple className="w-3 h-3" />
                    {badge}
                  </span>
                )}
                <h2 className="truncate text-lg font-semibold text-foreground">{title}</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Edit the text, inspect the rendered result, and reorder detected image blocks.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-xl border border-border bg-card p-1 shadow-sm">
                {[
                  { id: "write", label: "Write", icon: Rows },
                  { id: "split", label: "Split", icon: SquareSplitVertical },
                  { id: "preview", label: "Preview", icon: Eye },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setPaletteMode(id as PaletteMode)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      paletteMode === id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowSquareOut className="w-4 h-4" />
                  Source
                </a>
              )}
              {renderStatus()}
              {onClose && (
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                  Close
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden p-4">
          <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
            {paletteMode !== "preview" && (
              <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-border bg-card/95 shadow-xl">
                <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
                  Source
                </div>
                <div className="flex-1 min-h-0 overflow-auto p-4">
                  <textarea
                    value={draftContent}
                    onChange={(event) => setDraftContent(event.target.value)}
                    spellCheck={false}
                    className="min-h-[58vh] w-full resize-none bg-transparent font-mono text-sm leading-7 text-foreground outline-none"
                    placeholder={placeholder}
                  />
                </div>
                {notes !== undefined && (
                  <div className="border-t border-border p-4">
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Notes
                    </label>
                    <textarea
                      value={draftNotes}
                      onChange={(event) => setDraftNotes(event.target.value)}
                      className="min-h-[120px] w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary"
                      placeholder={notesPlaceholder}
                    />
                  </div>
                )}
              </div>
            )}

            {paletteMode !== "write" && (
              <div className={cn(
                "grid min-h-0 gap-4",
                paletteMode === "preview" ? "grid-cols-1" : "grid-cols-1"
              )}>
                <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-border bg-card/95 shadow-xl">
                  <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
                    Preview
                  </div>
                  <div ref={previewRef} className="min-h-0 flex-1 overflow-auto p-4">
                    {previewHtml ? (
                      contentKind === "html" ? (
                        <iframe
                          ref={iframeRef}
                          title={`${title} preview`}
                          sandbox="allow-same-origin"
                          className="min-h-[58vh] w-full rounded-2xl border border-border bg-background"
                          srcDoc={previewHtml}
                        />
                      ) : (
                        <div
                          className="prose prose-sm max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                      )
                    ) : (
                      <div className="flex min-h-[58vh] items-center justify-center rounded-2xl border border-dashed border-border bg-background/60 text-sm text-muted-foreground">
                        {emptyPreviewMessage}
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[24px] border border-border bg-card/95 shadow-xl">
                  <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
                    Image Order
                  </div>
                  <div className="max-h-[260px] overflow-auto p-3">
                    {images.length > 0 ? (
                      <div className="space-y-2">
                        {images.map((image, index) => (
                          <div
                            key={`${image.src}-${image.start}`}
                            className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 px-3 py-2"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                              <DotsSix className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {image.alt || `Image ${index + 1}`}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{image.src}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setDraftContent((current) => moveImageToken(current, images, index, -1))}
                                disabled={index === 0}
                                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                title="Move image up"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDraftContent((current) => moveImageToken(current, images, index, 1))}
                                disabled={index === images.length - 1}
                                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                title="Move image down"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-6 text-sm text-muted-foreground">
                        No markdown or HTML image blocks detected in this content yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
