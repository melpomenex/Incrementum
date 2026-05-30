import { pipeline, env } from "@huggingface/transformers";

// Configure environment for browser web worker
(env as any).allowLocalFiles = false;

let transcriber: any = null;
let currentModelId: string | null = null;

// Map progress from different files to get an aggregate percentage
const progressMap = new Map<string, number>();

/**
 * Helper to load or retrieve the pipeline
 */
async function getTranscriber(modelId: string, onProgress: (progress: number) => void) {
  if (transcriber && currentModelId === modelId) {
    onProgress(100);
    return transcriber;
  }

  const handleProgress = (data: any) => {
    if (data.status === "progress") {
      progressMap.set(data.file, data.progress);
      
      // Calculate average progress
      let totalProgress = 0;
      for (const p of progressMap.values()) {
        totalProgress += p;
      }
      const avgProgress = progressMap.size > 0 ? totalProgress / progressMap.size : 0;
      onProgress(avgProgress);
    } else if (data.status === "ready") {
      progressMap.set(data.file, 100);
      
      let totalProgress = 0;
      for (const p of progressMap.values()) {
        totalProgress += p;
      }
      const avgProgress = progressMap.size > 0 ? totalProgress / progressMap.size : 0;
      onProgress(avgProgress);
    } else if (data.status === "done") {
      progressMap.set(data.file, 100);
      onProgress(100);
    }
  };

  try {
    // Attempt WebGPU first
    transcriber = await pipeline("automatic-speech-recognition", modelId, {
      device: "webgpu",
      progress_callback: handleProgress,
      session_options: {
        graphOptimizationLevel: 'basic',
        extra: {
          'session.disable_qdq_graph_fusion': '1',
        }
      }
    });
  } catch (error) {
    console.warn("WebGPU not supported or failed to initialize, falling back to WebAssembly (wasm):", error);
    // Clear progress map to start fresh on fallback retry
    progressMap.clear();
    // Fall back to WebAssembly (WASM)
    transcriber = await pipeline("automatic-speech-recognition", modelId, {
      device: "wasm",
      progress_callback: handleProgress,
      session_options: {
        graphOptimizationLevel: 'basic',
        extra: {
          'session.disable_qdq_graph_fusion': '1',
        }
      }
    });
  }

  currentModelId = modelId;
  return transcriber;
}

self.onmessage = async (event: MessageEvent) => {
  const { type, modelId, audioData } = event.data;

  try {
    const formattedModelId = modelId.includes("/")
      ? modelId
      : `onnx-community/${modelId}-ONNX`;

    if (type === "load" || type === "download") {
      self.postMessage({ type: "status", status: "loading", progress: 0 });
      await getTranscriber(formattedModelId, (progress) => {
        self.postMessage({ type: "progress", progress: Math.min(99, progress) });
      });
      self.postMessage({ type: "status", status: "ready", progress: 100 });
    } else if (type === "transcribe") {
      if (!audioData) {
        throw new Error("Audio data is required for transcription");
      }

      self.postMessage({ type: "status", status: "processing", progress: 0 });
      
      const activeTranscriber = await getTranscriber(formattedModelId, () => {});
      
      self.postMessage({ type: "status", status: "processing", progress: 20 });
      
      // Run the transcription pipeline
      // We pass the 16kHz mono Float32Array directly
      const result = await activeTranscriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      });

      self.postMessage({ type: "status", status: "processing", progress: 95 });
      self.postMessage({ type: "result", result });
      self.postMessage({ type: "status", status: "ready", progress: 100 });
    }
  } catch (error: any) {
    self.postMessage({ type: "error", error: error.message || String(error) });
  }
};
