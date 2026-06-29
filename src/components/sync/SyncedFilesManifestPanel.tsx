/**
 * Settings panel showing the contents of the file-sync manifest.
 *
 * Renders every file registered for sync across all devices in the current
 * room. This is the primary diagnostic for file sync: if it's empty after
 * importing documents, registration isn't running; if it lists files the
 * library doesn't badge, the badge is the issue. Distinguishes "sync not
 * ready" (initialization failed) from "no files yet" (working, but nothing
 * imported/registered) so the user knows which.
 */

import { CloudSlash } from "@phosphor-icons/react";
import { SyncFilesPanel } from "./FileSyncStatusIndicator";
import { useFileSyncManifest } from "../../lib/useFileSyncManifest";

export function SyncedFilesManifestPanel() {
  const { ready, files } = useFileSyncManifest();

  if (!ready) {
    return (
      <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
        <CloudSlash className="w-5 h-5 opacity-60" />
        <span>
          File sync is not initialized on this device. State sync may still be
          working, but files won&apos;t transfer until this resolves. Restart the
          app; if it persists, check the sync room connection.
        </span>
      </div>
    );
  }

  return (
    <SyncFilesPanel
      files={files.map((f) => ({
        id: f.id,
        filename: f.filename,
        sizeBytes: f.sizeBytes,
        status: f.status,
      }))}
    />
  );
}
