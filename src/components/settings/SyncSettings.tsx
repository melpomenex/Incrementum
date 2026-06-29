import { useState, useEffect, useMemo } from "react";
import {
  ArrowsClockwise,
  Cloud,
  CloudSlash,
  Copy,
  Download,
  HardDrive,
  Key,
  Lock,
  LockOpen,
  Scan,
  WifiHigh,
} from "@phosphor-icons/react";
import { createNewSyncRoomId, getSyncRoomId, setSyncRoomId, rejoinRoom } from "../../lib/yjsSync";
import { useI18n } from "../../lib/i18n";
import { isNativeMobile, isPWA } from "../../lib/tauri";
import { QRCodeCanvas } from "qrcode.react";
import { SyncQrScanner } from "./SyncQrScanner";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  enableEncryption,
  enableEncryptionWithSecret,
  disableEncryption,
  isEncryptionEnabled,
  getCachedRoomSecretOrNull,
} from "../../lib/sync/roomCrypto";
import {
  encodeSyncQrPayload,
  parseSyncQrPayload,
  isSyncQrPayload,
  InvalidQrPayloadError,
} from "../../lib/sync/qrFormat";

// Feature flag for the device-sync end-to-end encryption UI (Phase 1 of the
// overhaul-cross-device-sync change). The crypto core, secure storage,
// encrypted provider wrapper, and yjsSync wiring all stay loaded — this only
// gates the user-facing controls. Flip to true to re-enable when ready
// (requires the forked relay deployed at sync.readsync.org — see task 1.8a).
const SYNC_ENCRYPTION_UI_ENABLED = false;

export function SyncSettings() {
  const { t } = useI18n();
  const [roomId, setRoomId] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [roomMessage, setRoomMessage] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  // Encryption state. `encryptionEnabled` reflects whether a derived room key
  // is cached on this device — if so, sync runs through EncryptedWebsocketProvider.
  // `roomSecret` is the user-shareable string (used to populate the QR). It is
  // null when encryption is off OR when we know a key is cached but the secret
  // isn't (e.g. user set it via an older build that didn't persist the secret).
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [roomSecret, setRoomSecret] = useState<string | null>(null);
  const [revealSecret, setRevealSecret] = useState(false);

  const { settings, updateSettings } = useSettingsStore();
  const syncSettings = settings.sync;
  const autoDownloadMode = syncSettings?.autoDownloadMode ?? "wifi-only";

  useEffect(() => {
    setRoomId(getSyncRoomId());
    if (SYNC_ENCRYPTION_UI_ENABLED) {
      void loadEncryptionState();
    }
  }, []);

  async function loadEncryptionState() {
    try {
      const enabled = await isEncryptionEnabled();
      setEncryptionEnabled(enabled);
      if (enabled) {
        const secret = await getCachedRoomSecretOrNull();
        setRoomSecret(secret);
      } else {
        setRoomSecret(null);
      }
    } catch (err) {
      console.warn("[SyncSettings] failed to load encryption state", err);
    }
  }

  // Decide whether THIS device is the scanner or the code-being-scanned.
  //   - Camera-bearing devices (native Android/iOS builds, plus PWA installs
  //     on phones) are the scanner: hide the QR, show the "Scan" button.
  //   - Everything else (desktop Tauri, desktop browser) shows the QR so a
  //     phone can scan it.
  //
  // The old gate was `display-mode: standalone`, which Tauri's WebView does
  // NOT report — so on native mobile `isStandalone` was false, `showQr` stayed
  // true, and the Scan button (gated on `!showQr`) never rendered. That is
  // why "mobile has no scan functionality": it was showing the QR image to the
  // phone that was supposed to do the scanning.
  useEffect(() => {
    const hasCamera = isNativeMobile() || isPWA();
    setShowQr(!hasCamera);
  }, []);

  useEffect(() => {
    if (!showScanner) {
      return;
    }
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [showScanner]);

  const handleCopyRoom = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setRoomMessage("Copied sync code to clipboard.");
    } catch {
      setRoomMessage("Failed to copy. You can still select and copy it manually.");
    }
  };

  /**
   * Join a sync room from a code (typed or scanned).
   *
   * `valueOverride` lets the QR scanner pass the scanned string directly
   * instead of round-tripping through the input field. Returns a result so the
   * scanner can decide whether to close (accepted) or keep scanning (rejected —
   * e.g. a malformed or non-sync payload). For the typed-input path the return
   * value is ignored.
   *
   * Joining switches the running sync to the new room in-process via
   * rejoinRoom() (tears down the old provider, writes the room ID, rebuilds),
   * so there is no longer a "reload to connect" step.
   */
  const handleJoinRoom = async (
    valueOverride?: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const raw = (valueOverride ?? joinRoomId).trim();
    if (!raw) {
      setRoomMessage("Enter a sync code to join.");
      return { ok: false, error: "Enter a sync code to join." };
    }

    // New-format payloads (`incrementum-sync:v1:<roomId>:<secret>`) carry
    // both the room ID and the encryption secret. Legacy plain room IDs are
    // accepted as-is — sync runs in "TLS only" mode for them.
    if (SYNC_ENCRYPTION_UI_ENABLED && isSyncQrPayload(raw)) {
      try {
        const parsed = parseSyncQrPayload(raw);
        await enableEncryptionWithSecret(parsed.roomId, parsed.roomSecret);
        setSyncRoomId(parsed.roomId);
        setRoomId(parsed.roomId);
        setEncryptionEnabled(true);
        setRoomSecret(parsed.roomSecret);
        setJoinRoomId("");
        await rejoinRoom(parsed.roomId);
        setRoomMessage("Joined encrypted room and connected.");
        return { ok: true };
      } catch (err) {
        const msg =
          err instanceof InvalidQrPayloadError
            ? `Invalid sync code: ${err.message}`
            : `Failed to join: ${(err as Error).message}`;
        setRoomMessage(msg);
        return { ok: false, error: msg };
      }
    }

    try {
      setSyncRoomId(raw);
      setRoomId(raw);
      setJoinRoomId("");
      await rejoinRoom(raw);
      setRoomMessage("Sync code applied and connected.");
      return { ok: true };
    } catch (err) {
      const msg = `Failed to join: ${(err as Error).message}`;
      setRoomMessage(msg);
      return { ok: false, error: msg };
    }
  };

  const handleRotateRoom = async () => {
    if (!confirm("Create a new sync code? This will stop syncing with devices on the old code.")) {
      return;
    }
    const next = createNewSyncRoomId();
    setRoomId(next);
    // Rotating the room ID invalidates any cached encryption key (the key
    // is derived from the secret + roomId, so the old key won't match the
    // new room). Clear it so the user re-enables encryption explicitly.
    if (SYNC_ENCRYPTION_UI_ENABLED && encryptionEnabled) {
      await disableEncryption().catch((e) =>
        console.warn("[SyncSettings] failed to clear encryption on room rotate", e),
      );
      setEncryptionEnabled(false);
      setRoomSecret(null);
      setRoomMessage("New sync code created. Re-enable encryption and share with your devices.");
    } else {
      setRoomMessage("New sync code created. Share it with your other devices.");
    }
  };

  const handleEnableEncryption = async () => {
    try {
      const secret = await enableEncryption(roomId);
      setEncryptionEnabled(true);
      setRoomSecret(secret);
      setRevealSecret(true);
      // The encryption key is read at provider-construction time, so rebuild
      // the provider against the same room to pick it up without a reload.
      await rejoinRoom(roomId).catch((e) =>
        console.warn("[SyncSettings] rejoin after enabling encryption failed", e),
      );
      setRoomMessage(
        "Encryption enabled and connected. Share the secret below (via QR or copy) with your other devices.",
      );
    } catch (err) {
      setRoomMessage(`Failed to enable encryption: ${(err as Error).message}`);
    }
  };

  const handleDisableEncryption = async () => {
    if (!confirm("Disable encryption on this device? Sync will continue in TLS-only mode.")) {
      return;
    }
    try {
      await disableEncryption();
      setEncryptionEnabled(false);
      setRoomSecret(null);
      setRevealSecret(false);
      await rejoinRoom(roomId).catch((e) =>
        console.warn("[SyncSettings] rejoin after disabling encryption failed", e),
      );
      setRoomMessage("Encryption disabled and connected.");
    } catch (err) {
      setRoomMessage(`Failed to disable: ${(err as Error).message}`);
    }
  };

  const handleResetEncryption = async () => {
    if (
      !confirm(
        "Generate a new encryption key? You'll need to share the new secret with every device that syncs this room.",
      )
    ) {
      return;
    }
    try {
      const secret = await enableEncryption(roomId);
      setRoomSecret(secret);
      setRevealSecret(true);
      setRoomMessage("New encryption key generated. Share the secret below with your devices.");
    } catch (err) {
      setRoomMessage(`Failed to reset key: ${(err as Error).message}`);
    }
  };

  const handleCopySecret = async () => {
    if (!roomSecret) return;
    try {
      await navigator.clipboard.writeText(roomSecret);
      setRoomMessage("Encryption secret copied to clipboard.");
    } catch {
      setRoomMessage("Failed to copy. Select the secret text manually.");
    }
  };

  // QR payload reflects the room + optional secret. When encryption is on
  // AND we have the secret cached, produce the new format so scanning peers
  // join encrypted automatically. Otherwise emit the bare roomId for
  // back-compat with older builds.
  const qrPayload = useMemo(() => {
    if (SYNC_ENCRYPTION_UI_ENABLED && encryptionEnabled && roomSecret) {
      return encodeSyncQrPayload(roomId, roomSecret);
    }
    return roomId;
  }, [roomId, encryptionEnabled, roomSecret]);

  const encryptionStatusLabel = encryptionEnabled
    ? "Encrypted"
    : roomId
      ? "TLS only — room secret"
      : "Not syncing";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Cloud className="w-8 h-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("syncSettings.title")}</h2>
          <p className="text-sm text-muted-foreground">
            Sync your reading data across your devices over a shared sync room.
          </p>
        </div>
      </div>

      {/* Device sync (room-based) */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">{t("syncSettings.deviceSync")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Use this sync code to connect your own devices. Anyone with the code can sync the
          same data.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t("syncSettings.yourSyncCode")}</label>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 bg-background border border-border rounded text-xs font-mono"
                value={roomId}
                readOnly
              />
              <button
                onClick={handleCopyRoom}
                className="px-3 py-2 bg-muted text-foreground rounded text-xs"
              >
                Copy
              </button>
              <button
                onClick={handleRotateRoom}
                className="px-3 py-2 bg-destructive text-destructive-foreground rounded text-xs"
              >
                New
              </button>
            </div>
          </div>
          {showQr && (
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-3">
              <QRCodeCanvas value={qrPayload} size={120} />
              <div className="text-xs text-muted-foreground">
                {SYNC_ENCRYPTION_UI_ENABLED && encryptionEnabled
                  ? "Scan to join with encryption. The secret is embedded in this code — keep it private."
                  : "Scan this QR code on your phone to join the same sync room."}
              </div>
            </div>
          )}

          {/* Encryption management — gated by SYNC_ENCRYPTION_UI_ENABLED.
              The supporting modules (encryption, secureStorage,
              encryptedProvider, qrFormat, roomCrypto) stay loaded; only
              the user-facing controls are hidden. */}
          {SYNC_ENCRYPTION_UI_ENABLED && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {encryptionEnabled ? (
                    <Lock className="w-4 h-4 text-green-500" />
                  ) : (
                    <LockOpen className="w-4 h-4 text-amber-500" />
                  )}
                  <span>End-to-end encryption</span>
                </div>
                <span className="text-xs text-muted-foreground">{encryptionStatusLabel}</span>
              </div>

              {encryptionEnabled ? (
                <>
                  {roomSecret && (
                    <div className="space-y-1">
                      <label className="block text-xs text-muted-foreground">
                        Room secret {revealSecret ? "" : "(hidden)"}
                      </label>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 px-2 py-1 bg-background border border-border rounded text-xs font-mono"
                          type={revealSecret ? "text" : "password"}
                          value={roomSecret}
                          readOnly
                        />
                        <button
                          onClick={() => setRevealSecret((v) => !v)}
                          className="px-2 py-1 bg-muted text-foreground rounded text-xs"
                        >
                          {revealSecret ? "Hide" : "Show"}
                        </button>
                        <button
                          onClick={handleCopySecret}
                          className="px-2 py-1 bg-muted text-foreground rounded text-xs flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Share this secret (or the QR above) with a device you trust. Anyone with it
                        can read your synced data.
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleResetEncryption}
                      className="flex-1 px-2 py-1 bg-muted text-foreground rounded text-xs flex items-center justify-center gap-1"
                    >
                      <Key className="w-3 h-3" /> Reset key
                    </button>
                    <button
                      onClick={handleDisableEncryption}
                      className="flex-1 px-2 py-1 bg-destructive text-destructive-foreground rounded text-xs"
                    >
                      Disable
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Without encryption, the relay can read your synced data. The room ID acts as a
                    shared secret over TLS — adequate for many users, but not bulletproof.
                  </p>
                  <button
                    onClick={handleEnableEncryption}
                    className="w-full px-3 py-2 bg-primary text-primary-foreground rounded text-xs flex items-center justify-center gap-1"
                  >
                    <Lock className="w-3 h-3" /> Enable encryption
                  </button>
                </>
              )}
            </div>
          )}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t("syncSettings.joinCode")}</label>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 bg-background border border-border rounded text-xs font-mono"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                placeholder="Paste sync code..."
              />
              <button
                onClick={() => { void handleJoinRoom(); }}
                className="px-3 py-2 bg-primary text-primary-foreground rounded text-xs"
              >
                Join
              </button>
              {!showQr && (
                <button
                  onClick={() => setShowScanner(true)}
                  className="px-3 py-2 bg-muted text-foreground rounded text-xs flex items-center gap-1"
                >
                  <Scan className="w-3.5 h-3.5" /> Scan
                </button>
              )}
            </div>
          </div>
          {roomMessage && <div className="text-xs text-muted-foreground">{roomMessage}</div>}
          <div className="text-xs text-muted-foreground">
            {t("syncSettings.scanToJoinHint")}
          </div>
        </div>
      </div>

      {showScanner && (
        <SyncQrScanner
          onDetected={async (value) => {
            const result = await handleJoinRoom(value);
            // Returning true closes the scanner; false keeps it open so the
            // user can re-scan after an invalid code.
            return result.ok;
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* File Sync Settings */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{t("syncSettings.fileSync")}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Files attached to your documents sync across your devices through the same room. Set how
          aggressively new files should be pulled onto this device.
        </p>

        <div className="space-y-4">
          {/* Auto-download setting */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Auto-download files from other devices
            </label>
            <select
              value={autoDownloadMode}
              onChange={(e) =>
                updateSettings({
                  sync: {
                    ...syncSettings,
                    autoDownloadMode: e.target.value as "always" | "wifi-only" | "manual",
                  },
                })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
            >
              <option value="always">
                Always - Download all files automatically
              </option>
              <option value="wifi-only">
                WiFi only - Auto-download only on WiFi (mobile)
              </option>
              <option value="manual">
                Manual - Never auto-download, request each file manually
              </option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {autoDownloadMode === "always" && (
                <span className="flex items-center gap-1">
                  <Download className="w-3 h-3" /> Files will be downloaded automatically when announced by other devices
                </span>
              )}
              {autoDownloadMode === "wifi-only" && (
                <span className="flex items-center gap-1">
                  <WifiHigh className="w-3 h-3" /> Files will wait for WiFi before downloading on mobile
                </span>
              )}
              {autoDownloadMode === "manual" && (
                <span>Files will appear with a download button - you choose what to download</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Sync not active hint — shown until a room is established. */}
      {!roomId && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3">
            <CloudSlash className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Sync is not active yet. A sync code has been generated for this device — share it with
              your other devices (or scan their code) to start syncing.
            </p>
          </div>
        </div>
      )}

      {/* Reassurance footer */}
      <div className="p-4 bg-muted/30 rounded-lg">
        <div className="flex items-start gap-2">
          <ArrowsClockwise className="w-4 h-4 text-primary mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">{t("syncSettings.e2eEncryption")}</p>
            <p>
              Your reading data is synced over a shared room. Keep your sync code private — anyone
              with it can sync the same data. When encryption is enabled, your data is encrypted on
              your device before it ever leaves.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
