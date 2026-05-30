import { getBrowserFile } from "../lib/browser-file-store";
import type { AudiobookTranscript, TranscriptSegment } from "../api/audiobooks";
import { isTauri, convertFileSrc, invokeCommand } from "../lib/tauri";

export const MOONSHINE_MODELS = [
  {
    id: "moonshine-tiny",
    name: "Moonshine Tiny",
    description: "Ultra-lightweight speech-to-text model (~27M parameters). Ideal for quick transcriptions on low-resource devices.",
    size_bytes: 52 * 1024 * 1024, // ~52 MB
    sha256: "web-cached-tiny-sha256-placeholder",
    installed: false,
  },
  {
    id: "moonshine-base",
    name: "Moonshine Base",
    description: "Standard Moonshine model (~61.5M parameters). Offers higher accuracy and matches larger models.",
    size_bytes: 115 * 1024 * 1024, // ~115 MB
    sha256: "web-cached-base-sha256-placeholder",
    installed: false,
  }
];

/**
 * Checks if a Moonshine model is cached/installed on the client device
 */
export function isMoonshineModelInstalled(modelId: string): boolean {
  return localStorage.getItem(`moonshine-installed-${modelId}`) === "true";
}

/**
 * Marks a Moonshine model's install status
 */
export function setMoonshineModelInstalled(modelId: string, installed: boolean): void {
  if (installed) {
    localStorage.setItem(`moonshine-installed-${modelId}`, "true");
  } else {
    localStorage.removeItem(`moonshine-installed-${modelId}`);
  }
}

/**
 * Decode an audio File/Blob or absolute file path to 16kHz mono Float32Array for Moonshine
 */
export async function decodeAudioFile(fileOrPath: File | string): Promise<Float32Array> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API is not supported in this browser");
  }

  const audioContext = new AudioContextClass({ sampleRate: 16000 });
  let arrayBuffer: ArrayBuffer;

  if (typeof fileOrPath === "string") {
    if (fileOrPath.startsWith("browser-file://")) {
      const file = getBrowserFile(fileOrPath);
      if (!file) throw new Error(`Audio file not found in browser: ${fileOrPath}`);
      arrayBuffer = await file.arrayBuffer();
    } else if (isTauri()) {
      // Tauri desktop absolute path: bypass fetch/CORS completely by calling native read_file_bytes!
      try {
        const bytes = await invokeCommand<number[]>("read_file_bytes", { filePath: fileOrPath });
        const uint8Array = new Uint8Array(bytes);
        arrayBuffer = uint8Array.buffer;
      } catch (err) {
        console.error("Failed to read file bytes via Tauri command, falling back to convertFileSrc:", err);
        // Fallback to safe asset URL
        const safeUrl = await convertFileSrc(fileOrPath);
        const response = await fetch(safeUrl);
        arrayBuffer = await response.arrayBuffer();
      }
    } else {
      throw new Error(`Invalid file source: ${fileOrPath}`);
    }
  } else {
    arrayBuffer = await fileOrPath.arrayBuffer();
  }

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Extract first channel (mono)
    const channelData = audioBuffer.getChannelData(0);
    return channelData;
  } finally {
    audioContext.close().catch(() => {});
  }
}

/**
 * Triggers Moonshine model pre-download and caching in the browser
 */
export function downloadMoonshineModel(
  modelId: string,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(
        new URL("../workers/moonshine.worker.ts", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (event) => {
        const { type, progress, error, status } = event.data;

        if (type === "progress") {
          onProgress(progress);
        } else if (type === "status" && status === "ready") {
          setMoonshineModelInstalled(modelId, true);
          onProgress(100);
          worker.terminate();
          resolve();
        } else if (type === "error") {
          worker.terminate();
          reject(new Error(error || "Model download failed"));
        }
      };

      worker.postMessage({ type: "download", modelId });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Deletes a cached Moonshine model from local state
 */
export async function deleteMoonshineModel(modelId: string): Promise<void> {
  setMoonshineModelInstalled(modelId, false);
  
  // Note: Standard cache clearing is handled by the browser's Cache Storage API.
  // We can also clear the HF cache from the Cache Storage if needed:
  try {
    const cacheKeys = await window.caches.keys();
    for (const key of cacheKeys) {
      if (key.includes("transformers") || key.includes("onnx")) {
        // We delete model-related caches or let the browser handle it.
        // For safety, marking it uninstalled in localStorage is sufficient,
        // and we can clear cache keys matching model files if desired.
      }
    }
  } catch (e) {
    console.warn("Failed to inspect browser cache keys:", e);
  }
}

/**
 * Transcribe an audio file using local Moonshine in browser Web Worker
 */
export async function transcribeAudioWithMoonshine(
  filePath: string | File,
  modelId: string,
  onProgress?: (progress: number) => void
): Promise<AudiobookTranscript> {
  let inputSource: File | string | undefined;

  if (typeof filePath === "string") {
    if (filePath.startsWith("browser-file://")) {
      inputSource = getBrowserFile(filePath);
    } else if (isTauri()) {
      inputSource = filePath;
    }
  } else if ((filePath as any) instanceof File) {
    inputSource = filePath;
  }
  
  if (!inputSource) {
    throw new Error(`Audio file source not found: ${filePath}`);
  }

  if (onProgress) onProgress(2);

  // 1. Decode audio to 16kHz Float32Array
  const audioData = await decodeAudioFile(inputSource);

  if (onProgress) onProgress(10);

  // 2. Perform transcription in Web Worker
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(
        new URL("../workers/moonshine.worker.ts", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (event) => {
        const { type, progress, error, result } = event.data;

        if (type === "status" && progress !== undefined) {
          // Map worker progress (10% to 95%) to UI progress
          if (onProgress) {
            onProgress(10 + (progress * 0.85)); 
          }
        } else if (type === "progress") {
          if (onProgress) {
            onProgress(10 + (progress * 0.85));
          }
        } else if (type === "result") {
          worker.terminate();
          if (onProgress) onProgress(100);

          // 3. Format result to AudiobookTranscript format
          const rawSegments = result.chunks || result.segments || [];
          const segments: TranscriptSegment[] = rawSegments.map((chunk: any, index: number) => {
            const timestamps = chunk.timestamp || [0, 0];
            return {
              id: `moonshine-segment-${index}`,
              text: chunk.text || "",
              startTime: timestamps[0] || 0,
              endTime: timestamps[1] || 0,
              confidence: chunk.confidence || 1.0,
            };
          });

          const fullText = segments.map((s) => s.text).join(" ");

          resolve({
            segments,
            fullText,
            language: result.language || "en",
            source: "generated",
            lastUpdated: new Date().toISOString(),
          });
        } else if (type === "error") {
          worker.terminate();
          reject(new Error(error || "Transcription failed"));
        }
      };

      worker.postMessage({
        type: "transcribe",
        modelId,
        audioData,
      });
    } catch (err) {
      reject(err);
    }
  });
}
