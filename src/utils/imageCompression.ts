/**
 * Image compression utility using Canvas API.
 * Resizes large images and converts to JPEG for smaller payload.
 */

const MAX_DIMENSION = 1280;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Compress an image data URL to fit within size constraints.
 * - Downscales to max 1280px on the longest side
 * - Converts to JPEG at 0.8 quality, falling back to 0.5
 *
 * @param dataUrl - Base64 data URL (data:image/...)
 * @param maxDimension - Max width or height in pixels (default 1280)
 * @param maxBytes - Maximum output size in bytes (default 5 MB)
 * @returns Compressed image data URL (data:image/jpeg;base64,...)
 */
export async function compressImage(
  dataUrl: string,
  maxDimension: number = MAX_DIMENSION,
  maxBytes: number = MAX_BYTES,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.onload = () => {
      let { width, height } = img;

      // Scale down if either dimension exceeds max
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas 2D context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Try JPEG at 0.8 quality (much smaller than PNG)
      const jpeg = canvas.toDataURL("image/jpeg", 0.8);
      if (jpeg.length <= maxBytes) {
        resolve(jpeg);
        return;
      }

      // Fall back to lower quality
      const jpegLow = canvas.toDataURL("image/jpeg", 0.5);
      resolve(jpegLow);
    };
    img.src = dataUrl;
  });
}

/**
 * Read a File as a data URL string.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader did not return a string"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
