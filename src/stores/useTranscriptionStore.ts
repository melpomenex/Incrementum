import { create } from "zustand";
import { listen } from "../lib/tauri";
import {
  getTranscriptionProfiles,
  getTranscript,
  ModelProfile,
  TranscriptSegment,
  TranscriptResponse
} from "../api/transcription";
import { isTauri } from "../lib/tauri";

interface TranscriptionState {
  profiles: ModelProfile[];
  downloadProgress: Record<string, number>;
  activeSegments: TranscriptSegment[];
  currentStatus: 'idle' | 'processing' | 'downloading';
  activeJob: { bookId: string, chapterId: string } | null;
  
  fetchProfiles: () => Promise<void>;
  loadTranscript: (bookId: string, chapterId: string) => Promise<void>;
  addSegment: (segment: TranscriptSegment) => void;
  setStatus: (status: 'idle' | 'processing' | 'downloading') => void;
  setDownloadProgress: (id: string, progress: number) => void;
}

export const useTranscriptionStore = create<TranscriptionState>((set, get) => ({
  profiles: [],
  downloadProgress: {},
  activeSegments: [],
  currentStatus: 'idle',
  activeJob: null,

  fetchProfiles: async () => {
    const profiles = await getTranscriptionProfiles();
    set({ profiles });
  },

  loadTranscript: async (bookId: string, chapterId: string) => {
    const response = await getTranscript(bookId, chapterId);
    if (response) {
      set({ activeSegments: response.segments });
    } else {
      set({ activeSegments: [] });
    }
  },

  addSegment: (segment) => {
    set((state) => ({
      activeSegments: [...state.activeSegments, segment].sort((a, b) => a.start_ms - b.start_ms)
    }));
  },

  setStatus: (status) => set({ currentStatus: status }),
  
  setDownloadProgress: (id, progress) => {
    set((state) => ({
      downloadProgress: { ...state.downloadProgress, [id]: progress }
    }));
  },
}));

// Setup event listeners (Tauri only - transcription backend events)
if (isTauri()) {
  listen("transcription://download-progress", (event: any) => {
    const { id, progress } = event.payload;
    useTranscriptionStore.getState().setDownloadProgress(id, progress);
    useTranscriptionStore.getState().setStatus('downloading');
  });

  listen("transcription://download-complete", () => {
    useTranscriptionStore.getState().setStatus('idle');
  });

  listen("transcription://status-change", (event: any) => {
    const job = event.payload;
    useTranscriptionStore.setState({ activeJob: { bookId: job.book_id, chapterId: job.chapter_id } });
    useTranscriptionStore.getState().setStatus('processing');
  });

  listen("transcription://segment", (event: any) => {
    const segment = event.payload as TranscriptSegment;
    useTranscriptionStore.getState().addSegment(segment);
  });

  listen("transcription://idle", () => {
    useTranscriptionStore.getState().setStatus('idle');
    useTranscriptionStore.setState({ activeJob: null });
  });
}
