/**
 * AnnotationsPanel
 * Sidebar panel listing all highlights and notes for the current article
 */

import { useEffect, useState } from "react";
import {
  Highlighter,
  Note,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useAnnotationsStore } from "../../stores/annotationsStore";
import type { RssAnnotation } from "../../api/rss-annotations";

interface AnnotationsPanelProps {
  articleId: string;
  onClose?: () => void;
}

const _HIGHLIGHT_COLORS = ["#FFE082", "#A5D6A7", "#90CAF9", "#CE93D8", "#EF9A9A"];

export function AnnotationsPanel({ articleId, onClose }: AnnotationsPanelProps) {
  const { annotationsByArticle, isLoading, loadAnnotations, deleteAnnotation } =
    useAnnotationsStore();

  useEffect(() => {
    void loadAnnotations(articleId);
  }, [articleId, loadAnnotations]);

  const annotations = annotationsByArticle.get(articleId) || [];
  const highlights = annotations.filter((a) => a.annotation_type === "highlight");
  const notes = annotations.filter((a) => a.annotation_type === "note");

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Annotations</h3>
        {onClose && (
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div>
        ) : annotations.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No annotations yet. Select text to highlight or add a note.
          </div>
        ) : (
          <>
            {highlights.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1">
                  <Highlighter className="w-3 h-3" />
                  Highlights ({highlights.length})
                </h4>
                <div className="space-y-2">
                  {highlights.map((h) => (
                    <AnnotationCard key={h.id} annotation={h} onDelete={() => void deleteAnnotation(h.id)} />
                  ))}
                </div>
              </div>
            )}
            {notes.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1">
                  <Note className="w-3 h-3" />
                  Notes ({notes.length})
                </h4>
                <div className="space-y-2">
                  {notes.map((n) => (
                    <AnnotationCard key={n.id} annotation={n} onDelete={() => void deleteAnnotation(n.id)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AnnotationCard({
  annotation,
  onDelete,
}: {
  annotation: RssAnnotation;
  onDelete: () => void;
}) {
  const [_isEditing, _setIsEditing] = useState(false);
  const { updateAnnotation: _updateAnnotation } = useAnnotationsStore();

  return (
    <div
      className="p-2 rounded border border-border/50 hover:border-border transition-colors group"
      style={annotation.color ? { borderLeftColor: annotation.color, borderLeftWidth: 3 } : undefined}
    >
      <p className="text-sm text-foreground line-clamp-3">{annotation.content}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">
          {new Date(annotation.created_at).toLocaleDateString()}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onDelete}
            className="p-1 text-muted-foreground hover:text-red-500 rounded"
          >
            <Trash className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
