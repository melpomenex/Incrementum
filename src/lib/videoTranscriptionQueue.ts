import { getTranscriptionProfiles } from "../api/transcription";
import { generateVideoTranscript, getVideoTranscript } from "../api/video-extracts";
import { useSettingsStore } from "../stores/settingsStore";
import { isTauri } from "./tauri";

type VideoTranscriptionStatus = "queued" | "processing" | "completed" | "failed" | "needs-model";

interface VideoTranscriptionJob {
  documentId: string;
  filePath: string;
  modelId: string;
  language: string;
}

interface VideoTranscriptionRequest {
  documentId: string;
  filePath: string;
  modelId?: string;
  language: string;
}

type StatusListener = (status: VideoTranscriptionStatus) => void;

const queue: VideoTranscriptionJob[] = [];
const statusByDocument = new Map<string, VideoTranscriptionStatus>();
const listenersByDocument = new Map<string, Set<StatusListener>>();
const activePlaybackDocuments = new Set<string>();
let isProcessing = false;

function notify(documentId: string, status: VideoTranscriptionStatus) {
  statusByDocument.set(documentId, status);
  const listeners = listenersByDocument.get(documentId);
  if (!listeners) return;
  listeners.forEach((listener) => listener(status));
}

function schedule(fn: () => void) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    (window as typeof window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(fn);
  } else {
    setTimeout(fn, 1000);
  }
}

function getPreferredModelId(): string | null {
  const preferred = useSettingsStore.getState().settings.audioTranscription.preferredModelId;
  return preferred || null;
}

async function resolveModelId(requestedModelId?: string): Promise<string | null> {
  try {
    const profiles = await getTranscriptionProfiles();
    const installed = profiles.filter((profile) => profile.installed);
    if (installed.length === 0) return null;

    if (requestedModelId) {
      const requested = installed.find((profile) => profile.id === requestedModelId);
      return requested ? requested.id : null;
    }

    const preferred = getPreferredModelId();
    if (preferred) {
      const match = installed.find((profile) => profile.id === preferred);
      if (match) return match.id;
    }

    const distil = installed.find((profile) => profile.id === "distil-small.en");
    return distil ? distil.id : installed[0].id;
  } catch {
    return null;
  }
}

function shouldDelayForPlayback(): boolean {
  return activePlaybackDocuments.size > 0;
}

async function processNext() {
  const job = queue.shift();
  if (!job) {
    isProcessing = false;
    return;
  }

  if (shouldDelayForPlayback()) {
    queue.unshift(job);
    isProcessing = false;
    schedule(() => kickQueue());
    return;
  }

  notify(job.documentId, "processing");

  try {
    const existing = await getVideoTranscript(job.documentId);
    if (!existing || existing.segments.length === 0) {
      await generateVideoTranscript(job.documentId, job.filePath, job.modelId, job.language);
    }
    notify(job.documentId, "completed");
  } catch {
    notify(job.documentId, "failed");
  } finally {
    isProcessing = false;
    if (queue.length > 0) {
      schedule(() => {
        isProcessing = true;
        void processNext();
      });
    }
  }
}

function kickQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;
  schedule(() => void processNext());
}

export async function enqueueVideoTranscription(request: VideoTranscriptionRequest) {
  if (!isTauri()) return;
  const modelId = await resolveModelId(request.modelId);
  if (!modelId) {
    notify(request.documentId, "needs-model");
    return;
  }
  queue.push({
    documentId: request.documentId,
    filePath: request.filePath,
    modelId,
    language: request.language,
  });
  notify(request.documentId, "queued");
  kickQueue();
}

export function setVideoPlaybackActive(documentId: string, active: boolean) {
  if (!documentId) return;
  if (active) {
    activePlaybackDocuments.add(documentId);
  } else {
    activePlaybackDocuments.delete(documentId);
  }
  if (!active) {
    kickQueue();
  }
}

export function getVideoTranscriptionStatus(documentId: string): VideoTranscriptionStatus | null {
  return statusByDocument.get(documentId) ?? null;
}

export function subscribeVideoTranscriptionStatus(
  documentId: string,
  listener: StatusListener
): () => void {
  const listeners = listenersByDocument.get(documentId) ?? new Set();
  listeners.add(listener);
  listenersByDocument.set(documentId, listeners);
  return () => {
    const current = listenersByDocument.get(documentId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listenersByDocument.delete(documentId);
    }
  };
}
