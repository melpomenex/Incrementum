/**
 * Tauri API wrapper for segmentation commands
 */

import { invokeCommand } from "../lib/tauri";

export interface SegmentationConfig {
  method: "semantic" | "paragraph" | "fixed" | "smart";
  targetLength: number;
  overlap: number;
}

export async function autoSegmentAndCreateExtracts(
  documentId: string,
  config?: Partial<SegmentationConfig>
): Promise<string[]> {
  return invokeCommand<string[]>("auto_segment_and_create_extracts", {
    documentId,
    method: config?.method,
    targetLength: config?.targetLength,
    overlap: config?.overlap,
  });
}

export async function getRecommendedSegmentation(
  fileType: string,
  contentLength: number
): Promise<SegmentationConfig> {
  const result = await invokeCommand<{
    method: string;
    targetLength: number;
    overlap: number;
  }>("get_recommended_segmentation", {
    fileType,
    contentLength,
  });
  return {
    method: result.method as SegmentationConfig["method"],
    targetLength: result.targetLength,
    overlap: result.overlap,
  };
}
