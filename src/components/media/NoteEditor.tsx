/**
 * NoteEditor
 * Inline text input for adding/editing/deleting notes on articles
 */

import { useState } from "react";
import { StickyNote, Save, X, Trash2 } from "lucide-react";
import { useAnnotationsStore } from "../../stores/annotationsStore";

interface NoteEditorProps {
  articleId: string;
  existingNote?: { id: string; content: string };
  onSave?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function NoteEditor({ articleId, existingNote, onSave, onCancel, autoFocus }: NoteEditorProps) {
  const { addNote, updateAnnotation, deleteAnnotation } = useAnnotationsStore();
  const [content, setContent] = useState(existingNote?.content || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      if (existingNote) {
        await updateAnnotation(existingNote.id, { content: content.trim() });
      } else {
        await addNote(articleId, content.trim());
      }
      onSave?.();
    } catch (err) {
      console.error("[NoteEditor] Failed to save note:", err);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (existingNote) {
      await deleteAnnotation(existingNote.id);
      onSave?.();
    }
  };

  return (
    <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg border border-border/50">
      <StickyNote className="w-4 h-4 text-muted-foreground mt-2 flex-shrink-0" />
      <textarea
        autoFocus={autoFocus}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a note..."
        rows={3}
        className="flex-1 text-sm bg-transparent resize-none focus:outline-none text-foreground placeholder:text-muted-foreground"
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel?.();
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void handleSave();
          }
        }}
      />
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => void handleSave()}
          disabled={!content.trim() || isSaving}
          className="p-1.5 text-emerald-600 hover:bg-emerald-500/10 rounded disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
        </button>
        {existingNote && (
          <button
            onClick={() => void handleDelete()}
            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={onCancel} className="p-1.5 text-muted-foreground hover:bg-muted/60 rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
