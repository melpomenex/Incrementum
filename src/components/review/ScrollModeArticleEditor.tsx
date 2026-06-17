import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  Image as ImageIcon,
  PencilLine,
  Scissors,
  TextT,
  WarningCircle,
} from "@phosphor-icons/react";
import { createExtract, type Extract } from "../../api/extracts";
import { updateDocumentContent } from "../../api/documents";
import { useToast } from "../common/Toast";
import type { Document } from "../../types/document";
import { useDocumentStore } from "../../stores/documentStore";
import { cn } from "../../utils";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface ScrollModeArticleEditorProps {
  document: Document;
  onExtractCreated?: (extract: Extract) => void;
  suppressSuccessToast?: boolean;
}

function htmlToPlainText(html?: string): string {
  if (!html) return "";
  const container = document.createElement("div");
  container.innerHTML = html;
  return (container.innerText || container.textContent || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeArticleHtml(html?: string): string {
  if (!html) return "";
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  parsed.querySelectorAll("script, style, iframe, object, embed, form, base").forEach((node) => node.remove());
  parsed.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (attribute.name.startsWith("on")) {
        element.removeAttribute(attribute.name);
      }
      if (
        (attribute.name === "href" || attribute.name === "src") &&
        /^javascript:/i.test(attribute.value)
      ) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return parsed.body.innerHTML;
}

function renderPlainTextPreview(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char] || char))}</p>`)
    .join("");
}

export function ScrollModeArticleEditor({
  document,
  onExtractCreated,
  suppressSuccessToast = false,
}: ScrollModeArticleEditorProps) {
  const toast = useToast();
  const { updateDocument } = useDocumentStore();
  const derivedArticleText = useMemo(
    () => document.content?.trim() || htmlToPlainText(document.metadata?.articleHtml),
    [document.content, document.metadata?.articleHtml]
  );
  const [content, setContent] = useState(derivedArticleText);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const lastSavedRef = useRef(content);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const articleImages = useMemo(
    () => document.metadata?.extractedImages?.filter((image) => image.src?.trim()) ?? [],
    [document.metadata?.extractedImages]
  );

  const articlePreviewHtml = useMemo(() => {
    const richHtml = sanitizeArticleHtml(document.metadata?.articleHtml);
    if (richHtml) return richHtml;
    return renderPlainTextPreview(derivedArticleText);
  }, [derivedArticleText, document.metadata?.articleHtml]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setContent(derivedArticleText);
    lastSavedRef.current = derivedArticleText;
    setSaveStatus("idle");
  }, [document.id, derivedArticleText]);

  useEffect(() => {
    if (content === lastSavedRef.current) {
      return;
    }

    setSaveStatus("dirty");

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const updated = await updateDocumentContent(document.id, content);
        if (!isMountedRef.current) return;
        lastSavedRef.current = content;
        updateDocument(document.id, { content: updated.content ?? content });
        setSaveStatus("saved");
        if (statusTimeoutRef.current) {
          clearTimeout(statusTimeoutRef.current);
        }
        statusTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setSaveStatus("idle");
          }
        }, 2000);
      } catch (error) {
        if (!isMountedRef.current) return;
        console.error("Failed to save article edits:", error);
        setSaveStatus("error");
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, document.id, updateDocument]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  const renderSaveStatus = () => {
    if (saveStatus === "saving") {
      return (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircleNotch className="w-3.5 h-3.5 animate-spin" />
          Saving...
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
          <WarningCircle className="w-3.5 h-3.5" />
          Save failed
        </span>
      );
    }
    if (saveStatus === "dirty") {
      return (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <PencilLine className="w-3.5 h-3.5" />
          Unsaved
        </span>
      );
    }
    return null;
  };

  const createSelectionExtract = useCallback(async () => {
    const nativeSelection = window.getSelection()?.toString().trim() || "";
    const textarea = textareaRef.current;
    const textareaSelection = textarea && textarea.selectionStart !== textarea.selectionEnd
      ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd).trim()
      : "";
    const selectionText = textareaSelection || nativeSelection;

    if (selectionText.length < 3) {
      toast.error("Select some article text first");
      return;
    }

    try {
      const created = await createExtract({
        document_id: document.id,
        content: selectionText,
        note: `Saved from web article: ${document.title}`,
      });
      onExtractCreated?.(created);
      window.getSelection()?.removeAllRanges();
      if (!suppressSuccessToast) {
        toast.success("Extract created");
      }
    } catch (error) {
      console.error("Failed to create extract from article selection:", error);
      toast.error("Failed to create extract");
    }
  }, [document.id, document.title, toast]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "e") {
        event.preventDefault();
        void createSelectionExtract();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createSelectionExtract]);

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-b from-background to-muted/20">
      <div className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg bg-blue-500/15 px-3 py-1.5 text-sm font-medium text-blue-400">
            <TextT className="w-4 h-4" />
            Web Article
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
            <Scissors className="w-4 h-4" />
            Ctrl/Cmd + E extracts selected text
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {document.filePath?.startsWith("http") && (
            <a
              href={document.filePath}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ArrowSquareOut className="w-4 h-4" />
              Open source
            </a>
          )}
          {renderSaveStatus()}
        </div>
      </div>

      <div className="grid h-full min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.9fr)]">
        <section className="flex min-h-0 flex-col border-b border-border/60 lg:border-b-0 lg:border-r">
          <div className="border-b border-border/50 px-6 py-4">
            <h1 className="text-2xl font-semibold text-foreground">{document.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Read the captured article, then select any passage and press `Ctrl/Cmd + E` to turn it into an extract.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {articlePreviewHtml ? (
              <article
                className={cn(
                  "prose prose-neutral max-w-none dark:prose-invert",
                  "prose-headings:scroll-mt-24 prose-img:rounded-xl prose-img:shadow-md"
                )}
                dangerouslySetInnerHTML={{ __html: articlePreviewHtml }}
              />
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                No article body was captured for this page.
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col">
          <div className="border-b border-border/50 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Editor
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The article text is editable here for cleanup, notes, and restructuring.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-[1.2] overflow-y-auto border-b border-border/50 p-6">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Article text will appear here when capture succeeds."
                className="min-h-full w-full resize-none rounded-2xl border border-border bg-card/70 p-5 text-sm leading-7 text-foreground outline-none transition focus:border-primary"
              />
            </div>

            <div className="min-h-[220px] flex-1 overflow-y-auto p-6">
              <div className="mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  Extracted Images
                </h3>
                <span className="text-xs text-muted-foreground">
                  {articleImages.length}
                </span>
              </div>

              {articleImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {articleImages.map((image, index) => (
                    <a
                      key={`${image.src}-${index}`}
                      href={image.src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40"
                    >
                      <img
                        src={image.src}
                        alt={image.alt || `Article image ${index + 1}`}
                        className="aspect-[4/3] w-full object-cover"
                        loading="lazy"
                      />
                      <div className="px-3 py-2 text-xs text-muted-foreground line-clamp-2">
                        {image.alt || `Image ${index + 1}`}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                  No article images were captured for this page.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
