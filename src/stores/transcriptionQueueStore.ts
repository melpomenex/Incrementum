import { create } from "zustand";
import { listen } from "../lib/tauri";
import {
  getTranscriptionQueue,
  cancelTranscriptionJob,
  retryTranscriptionJob,
  prioritizeTranscriptionJob,
  clearTranscriptionQueue,
  removeTranscriptionEntry,
  TranscriptionQueueEntryWithDoc,
  TranscriptionQueueEntry,
  TranscriptSegment,
} from "../api/transcription";
import { isTauri } from "../lib/tauri";

interface TranscriptionQueueState {
  entries: TranscriptionQueueEntryWithDoc[];
  activeProgress: number;
  activeSegments: number;
  activePhase: string | null;
  isLoading: boolean;

  fetchQueue: () => Promise<void>;
  cancel: (id: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
  prioritize: (id: string) => Promise<void>;
  clearByStatus: (statuses: string[]) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  getEntryForDocument: (documentId: string) => TranscriptionQueueEntryWithDoc | undefined;
}

export const useTranscriptionQueueStore = create<TranscriptionQueueState>((set, get) => ({
  entries: [],
  activeProgress: 0,
  activeSegments: 0,
  activePhase: null,
  isLoading: false,

  fetchQueue: async () => {
    set({ isLoading: true });
    try {
      const entries = await getTranscriptionQueue();
      set({ entries });
    } catch (e) {
      console.warn("[TranscriptionQueueStore] Failed to fetch queue:", e);
    } finally {
      set({ isLoading: false });
    }
  },

  cancel: async (id: string) => {
    await cancelTranscriptionJob(id);
    await get().fetchQueue();
  },

  retry: async (id: string) => {
    await retryTranscriptionJob(id);
    await get().fetchQueue();
  },

  prioritize: async (id: string) => {
    await prioritizeTranscriptionJob(id);
    await get().fetchQueue();
  },

  clearByStatus: async (statuses: string[]) => {
    await clearTranscriptionQueue(statuses);
    await get().fetchQueue();
  },

  removeEntry: async (id: string) => {
    await removeTranscriptionEntry(id);
    await get().fetchQueue();
  },

  getEntryForDocument: (documentId: string) => {
    return get().entries.find((e) => e.documentId === documentId);
  },
}));

// Setup event listeners
if (isTauri()) {
  const queueListeners: Promise<() => void>[] = [];

  function safeListen<T>(event: string, handler: (event: { payload: T }) => void) {
    queueListeners.push(
      listen(event, handler).catch((err) => {
        console.warn(`[TranscriptionQueueStore] Failed to listen to "${event}":`, err);
        return () => {};
      })
    );
  }

  safeListen<void>("transcription://queue-updated", () => {
    useTranscriptionQueueStore.getState().fetchQueue();
  });

  safeListen<{ progress: number }>("transcription://progress", (event) => {
    useTranscriptionQueueStore.setState({ activeProgress: event.payload.progress });
  });

  safeListen<TranscriptSegment>("transcription://segment", () => {
    const state = useTranscriptionQueueStore.getState();
    useTranscriptionQueueStore.setState({ activeSegments: state.activeSegments + 1 });
  });

  safeListen<{ phase: string }>("transcription://phase", (event) => {
    useTranscriptionQueueStore.setState({ activePhase: event.payload.phase });
  });

  safeListen<void>("transcription://idle", () => {
    useTranscriptionQueueStore.setState({ activeProgress: 0, activeSegments: 0, activePhase: null });
  });

  (globalThis as any).__transcriptionQueueListeners = queueListeners;
}
