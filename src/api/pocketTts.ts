/**
 * Pocket TTS API - Local text-to-speech via Tauri sidecar
 *
 * This module provides integration with Pocket TTS (https://github.com/kyutai-labs/pocket-tts)
 * for offline, low-latency text-to-speech on CPU.
 */

import { invokeCommand } from "../lib/tauri";
import { isTauri } from "../lib/tauri";

export interface PocketTTSOptions {
  text: string;
  voice: string;
  speed?: number; // 0.5 - 2.0 (currently unused - pocket-tts doesn't support speed adjustment)
}

export interface PocketTTSResult {
  audio_data: string; // Base64 data URL
  sample_rate: number;
  duration_sec: number;
}

export interface PocketTTSStatus {
  available: boolean;
  downloading: boolean;
  download_progress?: number; // 0-100
  error?: string;
}

/**
 * Check if Pocket TTS sidecar is available
 */
export async function checkPocketTTSAvailable(): Promise<PocketTTSStatus> {
  if (!isTauri()) {
    return {
      available: false,
      downloading: false,
      error: "Pocket TTS requires the Tauri desktop app",
    };
  }

  try {
    const status = await invokeCommand<PocketTTSStatus>("pocket_tts_status");
    return status;
  } catch (error) {
    return {
      available: false,
      downloading: false,
      error: error instanceof Error ? error.message : "Failed to check Pocket TTS status",
    };
  }
}

/**
 * Generate speech using Pocket TTS
 *
 * @param options - Text and voice settings
 * @returns Audio data URL and duration
 */
export async function generatePocketSpeech(options: PocketTTSOptions): Promise<{ audioUrl: string; durationSec: number }> {
  if (!isTauri()) {
    throw new Error("Pocket TTS requires the Tauri desktop app");
  }

  const result = await invokeCommand<PocketTTSResult>("pocket_tts_generate", {
    text: options.text,
    voice: options.voice,
    speed: options.speed ?? 1.0,
  });

  return {
    audioUrl: result.audio_data,
    durationSec: result.duration_sec,
  };
}

/**
 * Stop any ongoing Pocket TTS synthesis
 */
export async function stopPocketTTS(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  try {
    await invokeCommand<void>("pocket_tts_stop");
  } catch (error) {
    console.error("Failed to stop Pocket TTS:", error);
  }
}

/**
 * Clean up Pocket TTS resources
 */
export async function cleanupPocketTTS(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  try {
    await invokeCommand<void>("pocket_tts_cleanup");
  } catch (error) {
    console.error("Failed to cleanup Pocket TTS:", error);
  }
}
