import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { useI18n } from "../../lib/i18n";

type SyncQrScannerProps = {
  /**
   * Called with each decoded value. May be async. Return `true` to accept and
   * close the scanner; return `false` (or throw) to REJECT and keep scanning —
   * e.g. when the scanned payload is not a valid sync code, so the user can
   * re-aim at the right QR without re-opening the camera. Throw an Error to
   * also surface its `.message` inline as the `error`.
   */
  onDetected: (value: string) => boolean | Promise<boolean>;
  onClose: () => void;
};

export function SyncQrScanner({ onDetected, onClose }: SyncQrScannerProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  // useRef rather than state so the QrScanner callback (captured once on mount)
  // always reads the latest onDetected without re-creating the scanner.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    let scanner: QrScanner | null = null;

    const start = async () => {
      if (!videoRef.current) {
        return;
      }

      try {
        scanner = new QrScanner(
          videoRef.current,
          async (result) => {
            setError(null);
            try {
              const accepted = await onDetectedRef.current(result.data);
              if (accepted) {
                onClose();
              }
              // If not accepted, the scanner keeps running so the user can
              // re-scan. The caller is responsible for surfacing why (via
              // throw → we set `error` below, or its own UI).
            } catch (err) {
              const msg = err instanceof Error ? err.message : t("settings.syncQrInvalidCode");
              setError(msg);
            }
          },
          {
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: "environment",
          }
        );

        await scanner.start();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("settings.syncQrCameraFailed"));
      }
    };

    start();

    return () => {
      scanner?.stop();
      scanner?.destroy();
    };
  }, [onClose, t]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-lg bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium text-foreground">{t("settings.syncQrScanCode")}</div>
          <button
            onClick={onClose}
            className="rounded bg-muted px-2 py-1 text-xs text-foreground"
          >
            {t("common.close")}
          </button>
        </div>
        {error ? (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        ) : (
          <video
            ref={videoRef}
            className="aspect-square w-full rounded border border-border bg-black"
            muted
            playsInline
          />
        )}
        <div className="mt-2 text-xs text-muted-foreground">
          {t("settings.syncQrInstruction")}
        </div>
      </div>
    </div>
  );
}
