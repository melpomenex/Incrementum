export type PdfLoadSource = Record<string, unknown>;

export interface PdfLoadSourceFactory {
  create: () => PdfLoadSource;
}

interface CreatePdfLoadSourceFactoriesOptions {
  fileUrl?: string | null;
  fileData?: Uint8Array | null;
  disableFontFace: boolean;
}

function clonePdfData(fileData: Uint8Array): Uint8Array {
  return new Uint8Array(fileData);
}

export function createPdfLoadSourceFactories({
  fileUrl,
  fileData,
  disableFontFace,
}: CreatePdfLoadSourceFactoriesOptions): PdfLoadSourceFactory[] {
  const sources: PdfLoadSourceFactory[] = [];

  if (fileUrl) {
    sources.push({
      create: () => ({
        url: fileUrl,
        verbosity: 0,
        disableRange: true,
        disableStream: true,
        disableAutoFetch: true,
        disableFontFace,
      }),
    });
  }

  if (fileData) {
    sources.push({
      create: () => ({
        data: clonePdfData(fileData),
        verbosity: 0,
        disableFontFace,
      }),
    });
  }

  return sources;
}
