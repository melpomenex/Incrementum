/**
 * Wrapper that renders a FileSyncStatusIndicator for a single document.
 *
 * Exists as its own component (rather than inline in the document list) so the
 * `useDocumentFileSync` hook can be called once per document inside a `.map()`
 * without violating the rules of hooks. When the document has no `fileId` this
 * renders nothing.
 */

import { FileSyncStatusIndicator } from "./FileSyncStatusIndicator";
import { useDocumentFileSync } from "../../lib/useDocumentFileSync";
import type { Document } from "../../types";

interface DocumentFileSyncBadgeProps {
  doc: Document;
  size?: "sm" | "md";
}

export function DocumentFileSyncBadge({ doc, size = "sm" }: DocumentFileSyncBadgeProps) {
  const state = useDocumentFileSync(doc);
  if (!state) return null;
  // Hide the "synced" state on docs whose file is already local (the common
  // case for the importing device) to avoid visual noise — only surface status
  // when there's something actionable (available to download, downloading, etc).
  if (state.status === "synced") return null;
  return (
    <FileSyncStatusIndicator
      status={state.status}
      progress={state.progress}
      error={state.error}
      size={size}
      onDownloadClick={state.status === "available" ? () => { void state.download(); } : undefined}
    />
  );
}
