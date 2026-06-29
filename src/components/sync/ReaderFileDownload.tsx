/**
 * Reader-side file download affordance.
 *
 * Shown in the viewer's error states when a document's local file is missing
 * but the document is part of the sync manifest (has a `fileId`). Renders a
 * progress-aware download control; on completion the document's `filePath` is
 * updated by `useDocumentFileSync.download` so the viewer can re-attempt the
 * load without a manual refresh.
 *
 * Renders nothing when the document has no `fileId` (no sync source) or when
 * the file is already local (status "synced") — those cases have no action to
 * offer.
 */

import { FileSyncStatusDetail } from "./FileSyncStatusIndicator";
import { useDocumentFileSync } from "../../lib/useDocumentFileSync";
import type { Document } from "../../types";

interface ReaderFileDownloadProps {
  doc: Document;
}

export function ReaderFileDownload({ doc }: ReaderFileDownloadProps) {
  const state = useDocumentFileSync(doc);
  if (!state) return null;
  if (state.status === "synced") return null;
  return (
    <div className="mt-4">
      <FileSyncStatusDetail
        status={state.status}
        progress={state.progress}
        error={state.error}
        filename={doc.title}
        onDownloadClick={state.status === "available" ? () => { void state.download(); } : undefined}
        onRetryClick={state.status === "error" ? () => { void state.download(); } : undefined}
      />
    </div>
  );
}
