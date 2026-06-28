/**
 * PasteExtractDialog
 * A dialog for pasting content from the clipboard to create an extract,
 * defaulting to the currently open document.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Clipboard,
  FolderOpen,
  Lightbulb,
  MagnifyingGlass,
  Stack,
  Tag as TagIcon,
  X,
} from "@phosphor-icons/react";
import { createExtract, CreateExtractInput, Extract } from "../../api/extracts";
import { useDocumentStore } from "../../stores/documentStore";
import { useTabsStore } from "../../stores/tabsStore";
import { useToast } from "../common/Toast";
import { useI18n } from "../../lib/i18n";

interface PasteExtractDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (extract: Extract) => void;
}

// Common categories
const COMMON_CATEGORIES = [
  "Definition",
  "Concept",
  "Example",
  "Formula",
  "Quote",
  "Key Point",
  "Procedure",
];

// Common highlight colors
const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fef08a" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Purple", value: "#e9d5ff" },
];

export function PasteExtractDialog({ isOpen, onClose, onCreate }: PasteExtractDialogProps) {
  const { t } = useI18n();
  const toast = useToast();
  const documents = useDocumentStore((s) => s.documents);

  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentSearchQuery, setDocumentSearchQuery] = useState("");
  const [showDocumentSearch, setShowDocumentSearch] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const documentSearchRef = useRef<HTMLInputElement>(null);

  // Detect the active document from the current tab
  const detectActiveDocument = useCallback((): string | null => {
    try {
      const state = useTabsStore.getState();
      const paneIds = state.getTabPaneIds();
      if (paneIds.length === 0) return null;
      const pane = state.findPaneById(paneIds[0]);
      if (!pane || pane.type !== "tabs" || !pane.activeTabId) return null;
      const activeTab = state.tabs.find((t) => t.id === pane.activeTabId);
      if (!activeTab || activeTab.type !== "document-viewer") return null;
      const docId = activeTab.data?.documentId as string | undefined;
      return docId || null;
    } catch {
      return null;
    }
  }, []);

  // Reset and auto-detect on open
  useEffect(() => {
    if (isOpen) {
      setContent("");
      setNotes("");
      setCategory("");
      setTags([]);
      setTagInput("");
      setHighlightColor(HIGHLIGHT_COLORS[0].value);
      setDocumentSearchQuery("");
      setShowDocumentSearch(false);
      setError(null);
      setIsCreating(false);

      // Auto-detect the active document
      const activeDocId = detectActiveDocument();
      setSelectedDocumentId(activeDocId);

      // Try to read clipboard contents
      navigator.clipboard.readText().then((text) => {
        if (text && text.trim()) {
          setContent(text.trim());
        }
      }).catch(() => {
        // Clipboard access denied or not available — that's fine
      });

      // Focus the textarea after mount
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen, detectActiveDocument]);

  // Focus document search input when opened
  useEffect(() => {
    if (showDocumentSearch) {
      setTimeout(() => {
        documentSearchRef.current?.focus();
      }, 50);
    }
  }, [showDocumentSearch]);

  const selectedDocument = documents.find((d) => d.id === selectedDocumentId);

  // Filter documents for search
  const filteredDocuments = documentSearchQuery.trim()
    ? documents.filter((doc) => {
        const q = documentSearchQuery.toLowerCase();
        return (
          doc.title.toLowerCase().includes(q) ||
          doc.fileType?.toLowerCase().includes(q) ||
          doc.category?.toLowerCase().includes(q) ||
          doc.tags?.some((tag) => tag.toLowerCase().includes(q))
        );
      }).slice(0, 20)
    : documents.slice(0, 10);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleCreate = async () => {
    if (!content.trim()) {
      setError(t("extracts.contentRequired") || "Content is required");
      return;
    }
    if (!selectedDocumentId) {
      setError("Please select a document to save the extract to");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const input: CreateExtractInput = {
        document_id: selectedDocumentId,
        content: content.trim(),
        note: notes.trim() || undefined,
        category: category || undefined,
        tags: tags.length > 0 ? tags : undefined,
        color: highlightColor,
      };

      const extract = await createExtract(input);
      toast.success(t("extracts.extractCreated") || "Extract created");
      onCreate?.(extract);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create extract");
    } finally {
      setIsCreating(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setContent(text.trim());
      }
    } catch {
      // Clipboard access denied
    }
  };

  if (!isOpen) return null;

  // Portaled to document.body so the fixed-position backdrop/panel escape any
  // ancestor stacking context (the app shell's backdrop-filter / transforms
  // would otherwise trap the dialog and render it behind viewer content).
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Clipboard className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Paste Extract
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Document Context */}
        <div className="px-4 py-3 bg-muted/30 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
              {selectedDocument ? (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    Saving to: {selectedDocument.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selectedDocument.fileType?.toUpperCase() || "Document"}
                    {selectedDocument.category ? ` • ${selectedDocument.category}` : ""}
                  </div>
                </div>
              ) : selectedDocumentId === null ? (
                <span className="text-sm text-muted-foreground">
                  No document selected — extracts need a source document
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Loading document...</span>
              )}
            </div>
            <button
              onClick={() => setShowDocumentSearch(!showDocumentSearch)}
              className="ml-2 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 text-muted-foreground rounded transition-colors flex items-center gap-1 shrink-0"
            >
              <MagnifyingGlass className="w-3 h-3" />
              {showDocumentSearch ? "Done" : "Change"}
            </button>
          </div>

          {/* Document Search */}
          {showDocumentSearch && (
            <div className="mt-3">
              <input
                ref={documentSearchRef}
                type="text"
                value={documentSearchQuery}
                onChange={(e) => setDocumentSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {filteredDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSelectedDocumentId(doc.id);
                      setShowDocumentSearch(false);
                      setDocumentSearchQuery("");
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      doc.id === selectedDocumentId
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="truncate font-medium">{doc.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {doc.fileType?.toUpperCase() || "Document"}
                      {doc.extractCount !== undefined && ` • ${doc.extractCount} extracts`}
                    </div>
                  </button>
                ))}
                {filteredDocuments.length === 0 && (
                  <div className="text-sm text-muted-foreground px-3 py-2">
                    No documents found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Content textarea */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Content <span className="text-destructive">*</span>
            </label>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your extract content here... (Ctrl+V / Cmd+V)"
              rows={6}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-vertical font-mono text-sm"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {content.length} character{content.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handlePaste}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Clipboard className="w-3 h-3" />
                Re-paste from clipboard
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your thoughts, context, or explanations..."
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <FolderOpen className="w-4 h-4 inline mr-1" />
              Category
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMMON_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(category === cat ? "" : cat)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    category === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Or enter custom category..."
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <TagIcon className="w-4 h-4 inline mr-1" />
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors text-sm"
              >
                Add
              </button>
            </div>
          </div>

          {/* Highlight Color */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Highlight Color
            </label>
            <div className="flex flex-wrap gap-2">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setHighlightColor(color.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    highlightColor === color.value
                      ? "border-primary scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 bg-card border border-border text-foreground rounded-md hover:bg-muted transition-colors disabled:opacity-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !content.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
          >
            {isCreating ? "Saving..." : "Save Extract"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
