import { invokeCommand } from "../lib/tauri";
import { isTauri } from "../lib/tauri";

export interface ModelProfile {
  id: string;
  name: string;
  description: string;
  url: string;
  sha256: string;
  size_bytes: number;
}

export interface TranscriptSegment {
  start_ms: number;
  end_ms: number;
  text: string;
  confidence: number;
}

export interface TranscriptResponse {
  id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  segments: TranscriptSegment[];
}

export const getTranscriptionProfiles = (): Promise<ModelProfile[]> => {
  if (!isTauri()) {
    // Web/PWA: transcription requires Tauri backend with Whisper
    return Promise.reject(new Error("Transcription is only available in the Tauri desktop app"));
  }
  return invokeCommand("get_transcription_profiles");
};

export const downloadTranscriptionModel = (id: string): Promise<void> => {
  if (!isTauri()) {
    return Promise.reject(new Error("Transcription is only available in the Tauri desktop app"));
  }
  return invokeCommand("download_transcription_model", { id });
};

export const deleteTranscriptionModel = (id: string): Promise<void> => {
  if (!isTauri()) {
    return Promise.reject(new Error("Transcription is only available in the Tauri desktop app"));
  }
  return invokeCommand("delete_transcription_model", { id });
};

export const startTranscription = (
  bookId: string,
  chapterId: string,
  audioPath: string,
  modelId: string,
  language: string
): Promise<void> => {
  if (!isTauri()) {
    return Promise.reject(new Error("Transcription is only available in the Tauri desktop app"));
  }
  return invokeCommand("start_transcription", {
    bookId,
    chapterId,
    audioPath,
    modelId,
    language,
  });
};

export const getTranscript = (
  bookId: string,
  chapterId: string
): Promise<TranscriptResponse | null> => {
  if (!isTauri()) {
    // Web/PWA: return empty transcript
    return Promise.resolve(null);
  }
  return invokeCommand("get_transcript", { bookId, chapterId });
};
