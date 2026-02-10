import { getSyncRoomId } from "./yjsSync";

export type YjsFileMeta = {
  id: string;
  room: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  deletedAt: string | null;
};

const DEFAULT_YJS_SYNC_URL = "wss://sync.readsync.org";

function wsUrlToHttpOrigin(wsUrl: string): string {
  const u = new URL(wsUrl);
  if (u.protocol === "wss:") u.protocol = "https:";
  else if (u.protocol === "ws:") u.protocol = "http:";
  return u.origin;
}

export function getYjsFileServiceBaseUrl(): string {
  const wsUrl = import.meta.env.VITE_YJS_SYNC_URL || DEFAULT_YJS_SYNC_URL;
  return wsUrlToHttpOrigin(wsUrl);
}

export function createYjsFilePath(room: string, id: string, filename?: string): string {
  // File path is used as a stable key for IndexedDB caching.
  const safeName = filename ? encodeURIComponent(filename) : "";
  return `yjs-file://${room}/${id}/${safeName}`;
}

export function parseYjsFilePath(filePath: string): { room: string; id: string; filename: string | null } | null {
  if (!filePath.startsWith("yjs-file://")) return null;
  // yjs-file://<room>/<id>/<filename?>
  const withoutScheme = filePath.slice("yjs-file://".length);
  const parts = withoutScheme.split("/");
  const room = parts[0] || "";
  const id = parts[1] || "";
  const filenameEncoded = parts.slice(2).join("/") || "";
  if (!room || !id) return null;
  const filename = filenameEncoded ? decodeURIComponent(filenameEncoded) : null;
  return { room, id, filename };
}

export async function uploadRoomFile(file: File, room?: string): Promise<YjsFileMeta> {
  const useRoom = room || getSyncRoomId();
  const form = new FormData();
  form.append("file", file);

  const base = getYjsFileServiceBaseUrl();
  const res = await fetch(`${base}/files/${encodeURIComponent(useRoom)}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`yjs file upload failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as YjsFileMeta;
}

export async function downloadRoomFile(room: string, id: string): Promise<Blob> {
  const base = getYjsFileServiceBaseUrl();
  const res = await fetch(`${base}/files/${encodeURIComponent(room)}/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`yjs file download failed (${res.status}): ${text || res.statusText}`);
  }
  return await res.blob();
}

