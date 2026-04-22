export type LocalMediaType = "video" | "audio";

export type LocalMediaFailureKind =
  | "source-access"
  | "unsupported-format"
  | "decode"
  | "aborted"
  | "unknown";

export interface LocalMediaSourceCandidate {
  src: string;
  mimeType?: string;
  strategy?: string;
  label?: string;
  alreadyPlayable?: boolean;
}

export interface LocalMediaSourceDescriptor {
  sources: LocalMediaSourceCandidate[];
}

export type LocalMediaSourceInput =
  | string
  | LocalMediaSourceCandidate
  | LocalMediaSourceDescriptor;

export interface LocalMediaProbeFailure {
  kind: LocalMediaFailureKind;
  message: string;
  mediaErrorCode?: number;
  mimeTypeSupport?: CanPlayTypeResult;
}

export interface LocalMediaProbeResult {
  ok: boolean;
  candidate: LocalMediaSourceCandidate;
  failure?: LocalMediaProbeFailure;
}

function normalizeCandidate(
  candidate: LocalMediaSourceCandidate,
  index: number,
): LocalMediaSourceCandidate {
  return {
    ...candidate,
    strategy: candidate.strategy || candidate.label || `source-${index + 1}`,
  };
}

export function normalizeLocalMediaSources(
  input: LocalMediaSourceInput,
): LocalMediaSourceCandidate[] {
  if (typeof input === "string") {
    return [{ src: input, strategy: "direct-url" }];
  }

  if ("sources" in input) {
    return input.sources
      .filter((candidate) => Boolean(candidate?.src))
      .map(normalizeCandidate);
  }

  if ("src" in input && input.src) {
    return [normalizeCandidate(input, 0)];
  }

  return [];
}

export function getLocalMediaSourceKey(
  sources: LocalMediaSourceCandidate[],
): string {
  return sources
    .map((candidate) => [
      candidate.src,
      candidate.mimeType || "",
      candidate.strategy || "",
      candidate.alreadyPlayable ? "1" : "0",
    ].join("|"))
    .join("||");
}

export function getMimeTypeSupport(
  mediaType: LocalMediaType,
  mimeType?: string,
): CanPlayTypeResult {
  if (typeof document === "undefined" || !mimeType) {
    return "";
  }

  const media = document.createElement(mediaType);
  return media.canPlayType(mimeType);
}

export function classifyLocalMediaError(
  candidate: LocalMediaSourceCandidate,
  mediaType: LocalMediaType,
  errorCode?: number,
): LocalMediaProbeFailure {
  const mimeTypeSupport = getMimeTypeSupport(mediaType, candidate.mimeType);
  const protocolMatch = candidate.src.match(/^[a-zA-Z][a-zA-Z\d+.-]*:/);
  const protocol = protocolMatch ? protocolMatch[0].toLowerCase() : "";
  const localProtocol = protocol === "asset:" || protocol === "tauri:" || protocol === "file:";

  if (errorCode === MediaError.MEDIA_ERR_ABORTED) {
    return {
      kind: "aborted",
      message: "Playback was interrupted before the media finished loading.",
      mediaErrorCode: errorCode,
      mimeTypeSupport,
    };
  }

  if (errorCode === MediaError.MEDIA_ERR_NETWORK) {
    return {
      kind: "source-access",
      message: "The media source could not be opened or read by the current app runtime.",
      mediaErrorCode: errorCode,
      mimeTypeSupport,
    };
  }

  if (errorCode === MediaError.MEDIA_ERR_DECODE) {
    return {
      kind: "decode",
      message: "The file was opened, but the embedded browser could not decode its media stream.",
      mediaErrorCode: errorCode,
      mimeTypeSupport,
    };
  }

  if (errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    if (mimeTypeSupport === "probably" || mimeTypeSupport === "maybe" || localProtocol) {
      return {
        kind: "source-access",
        message: "The local media source was rejected before playback could begin.",
        mediaErrorCode: errorCode,
        mimeTypeSupport,
      };
    }

    return {
      kind: "unsupported-format",
      message: "The file format or codec is not supported by the embedded browser.",
      mediaErrorCode: errorCode,
      mimeTypeSupport,
    };
  }

  return {
    kind: "unknown",
    message: "The media source could not be validated.",
    mediaErrorCode: errorCode,
    mimeTypeSupport,
  };
}

export async function probeLocalMediaSource(
  candidate: LocalMediaSourceCandidate,
  mediaType: LocalMediaType,
  timeoutMs = 8000,
): Promise<LocalMediaProbeResult> {
  if (candidate.alreadyPlayable || typeof document === "undefined") {
    return { ok: true, candidate };
  }

  return new Promise<LocalMediaProbeResult>((resolve) => {
    const media = document.createElement(mediaType);
    let settled = false;

    const cleanup = () => {
      media.pause();
      media.removeAttribute("src");
      media.load();
      media.onerror = null;
      media.onloadedmetadata = null;
      media.oncanplay = null;
    };

    const finish = (result: LocalMediaProbeResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      cleanup();
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish({
        ok: false,
        candidate,
        failure: {
          kind: "source-access",
          message: "Timed out while probing the media source for initial playback.",
          mimeTypeSupport: getMimeTypeSupport(mediaType, candidate.mimeType),
        },
      });
    }, timeoutMs);

    media.preload = "metadata";
    media.muted = true;
    if (mediaType === "video") {
      (media as HTMLVideoElement).playsInline = true;
    }

    media.onloadedmetadata = () => finish({ ok: true, candidate });
    media.oncanplay = () => finish({ ok: true, candidate });
    media.onerror = () => {
      finish({
        ok: false,
        candidate,
        failure: classifyLocalMediaError(candidate, mediaType, media.error?.code),
      });
    };

    media.src = candidate.src;
    media.load();
  });
}
