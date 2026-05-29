/**
 * Notification Settings Component
 * Configures notification preferences for both PWA and Tauri
 */

import { useState, useEffect } from "react";
import {
  Bell,
  BellRing,
  Clock,
  Calendar,
  Volume2,
  VolumeX,
  Smartphone,
  Monitor,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Play,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useI18n } from "../../lib/i18n";
import { isTauri, isPWA } from "../../lib/tauri";
import {
  requestNotificationPermission,
  checkNotificationPermission,
  scheduleNotification,
  type NotificationPermission,
} from "../../utils/notificationService";
import {
  NOTIFICATION_SOUND_OPTIONS,
  NOTIFICATION_SOUND_FILES,
  playFile,
  playNotificationDefaultTone,
  supportsHaptics,
  type NotificationSoundId,
} from "../../utils/soundService";

interface NotificationSettingsProps {
  onChange?: () => void;
}

/**
 * Background Notification Settings (PWA only)
 * Uses Periodic Background Sync API - no server needed.
 */
function BackgroundNotificationSettings({
  enabled,
  permission,
}: {
  enabled: boolean;
  permission: NotificationPermission;
}) {
  const { t } = useI18n();
  const [bgStatus, setBgStatus] = useState<{
    supported: boolean;
    subscribed: boolean;
    loading: boolean;
  }>({ supported: false, subscribed: false, loading: false });

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const { getPushSubscriptionStatus } = await import("../../utils/pushSubscription");
      const status = await getPushSubscriptionStatus();
      setBgStatus({ supported: status.supported, subscribed: status.subscribed, loading: false });
    } catch {
      setBgStatus((s) => ({ ...s, supported: false, loading: false }));
    }
  };

  const handleEnable = async () => {
    setBgStatus((s) => ({ ...s, loading: true }));
    try {
      const { subscribeToPush } = await import("../../utils/pushSubscription");
      const ok = await subscribeToPush();
      setBgStatus((s) => ({ ...s, subscribed: ok, loading: false }));
    } catch (err) {
      console.error("Background sync registration failed:", err);
      setBgStatus((s) => ({ ...s, loading: false }));
    }
  };

  const handleDisable = async () => {
    setBgStatus((s) => ({ ...s, loading: true }));
    try {
      const { unsubscribeFromPush } = await import("../../utils/pushSubscription");
      await unsubscribeFromPush();
      setBgStatus((s) => ({ ...s, subscribed: false, loading: false }));
    } catch (err) {
      console.error("Background sync unregister failed:", err);
      setBgStatus((s) => ({ ...s, loading: false }));
    }
  };

  if (!bgStatus.supported) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Background notifications require Chrome/Edge and the app to be installed as a PWA.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgStatus.subscribed ? "bg-green-500/10" : "bg-yellow-500/10"}`}>
          <Bell className={`w-5 h-5 ${bgStatus.subscribed ? "text-green-500" : "text-yellow-500"}`} />
        </div>
        <div>
          <p className="font-medium">{t("notificationSettings.backgroundReminders")}</p>
          <p className="text-sm text-muted-foreground">
            {bgStatus.subscribed
              ? "Active - you'll be reminded about due cards even when the app is closed"
              : "Get notified about due review cards when the app isn't open"}
          </p>
        </div>
      </div>
      <button
        onClick={bgStatus.subscribed ? handleDisable : handleEnable}
        disabled={bgStatus.loading || permission !== "granted" || !enabled}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          bgStatus.subscribed
            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {bgStatus.loading ? "..." : bgStatus.subscribed ? "Disable" : "Enable"}
      </button>
    </div>
  );
}

/**
 * Notification Settings Component
 */
export function NotificationSettings({ onChange }: NotificationSettingsProps) {
  const { t } = useI18n();
  const hapticsSupported = supportsHaptics();
  const { settings, updateSettingsCategory } = useSettingsStore();
  const notificationSettings = settings.notifications;

  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isRequesting, setIsRequesting] = useState(false);
  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [platform, setPlatform] = useState<"tauri" | "pwa" | "web">("web");

  // Detect platform on mount
  useEffect(() => {
    if (isTauri()) {
      setPlatform("tauri");
    } else if (isPWA()) {
      setPlatform("pwa");
    } else {
      setPlatform("web");
    }
  }, []);

  useEffect(() => {
    checkNotificationPermission().then(setPermission);
  }, []);

  const handleUpdate = (updates: Partial<typeof notificationSettings>) => {
    updateSettingsCategory("notifications", updates);
    onChange?.();
  };

  // Request notification permission
  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const newPermission = await requestNotificationPermission();
      setPermission(newPermission);

      // Auto-enable notifications if granted
      if (newPermission === "granted" && !notificationSettings.enabled) {
        handleUpdate({ enabled: true });
      }
    } finally {
      setIsRequesting(false);
    }
  };

  // Send test notification
  const handleTestNotification = async () => {
    const result = await scheduleNotification({
      title: "Test Notification",
      body: "This is a test notification from Incrementum!",
      icon: "/icon.png",
      tag: "test",
    });

    if (result) {
      setTestNotificationSent(true);
      setTimeout(() => setTestNotificationSent(false), 3000);
    }
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case "granted":
        return {
          icon: CheckCircle,
          color: "text-green-500",
          bg: "bg-green-500/10",
          text: "Permission granted",
        };
      case "denied":
        return {
          icon: XCircle,
          color: "text-red-500",
          bg: "bg-red-500/10",
          text: "Permission denied",
        };
      default:
        return {
          icon: AlertCircle,
          color: "text-yellow-500",
          bg: "bg-yellow-500/10",
          text: "Permission not requested",
        };
    }
  };

  const permissionStatus = getPermissionStatus();
  const PermissionIcon = permissionStatus.icon;

  return (
    <div className="space-y-8">
      {/* Platform Info */}
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        {platform === "tauri" ? (
          <Monitor className="w-5 h-5 text-primary" />
        ) : platform === "pwa" ? (
          <Smartphone className="w-5 h-5 text-primary" />
        ) : (
          <Info className="w-5 h-5 text-primary" />
        )}
        <div>
          <p className="text-sm font-medium">
            Platform: {platform === "tauri" ? "Desktop App" : platform === "pwa" ? "Installed PWA" : "Web Browser"}
          </p>
          <p className="text-xs text-muted-foreground">
            {platform === "tauri"
              ? "Using native desktop notifications"
              : platform === "pwa"
              ? "Using PWA push notifications"
              : "Install as PWA for better notification support"}
          </p>
        </div>
      </div>

      {/* Permission Status */}
      <section>
        <h3 className="text-lg font-semibold mb-4">{t("notificationSettings.title")}</h3>
        <div className="space-y-4">
          <div
            className={`flex items-center gap-3 p-4 rounded-lg ${permissionStatus.bg}`}
          >
            <PermissionIcon className={`w-5 h-5 ${permissionStatus.color}`} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${permissionStatus.color}`}>
                {permissionStatus.text}
              </p>
              <p className="text-xs text-muted-foreground">
                {permission === "granted"
                  ? "You will receive notifications based on your preferences"
                  : permission === "denied"
                  ? "Please enable notifications in your browser or system settings"
                  : "Click the button below to enable notifications"}
              </p>
            </div>
            {permission !== "granted" && (
              <button
                onClick={handleRequestPermission}
                disabled={isRequesting || permission === "denied"}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isRequesting ? "Requesting..." : "Enable Notifications"}
              </button>
            )}
          </div>

          {permission === "denied" && (
            <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                <strong>How to enable:</strong>
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                {platform === "tauri" ? (
                  <>
                    <li>Open System Preferences → Notifications</li>
                    <li>Find Incrementum in the list</li>
                    <li>Enable "Allow Notifications"</li>
                  </>
                ) : (
                  <>
                    <li>Click the lock icon in the address bar</li>
                    <li>Find "Notifications" in site settings</li>
                    <li>Change to "Allow"</li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Main Toggle */}
      <section>
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{t("notificationSettings.enableNotifications")}</p>
              <p className="text-sm text-muted-foreground">
                Receive notifications for study reminders and due dates
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={notificationSettings.enabled}
              onChange={(e) => handleUpdate({ enabled: e.target.checked })}
              disabled={permission !== "granted"}
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary disabled:opacity-50"></div>
          </label>
        </div>
      </section>

      {/* Notification Types */}
      <section>
        <h3 className="text-lg font-semibold mb-4">{t("notificationSettings.notificationTypes")}</h3>
        <div className="space-y-4">
          {/* Study Reminders */}
          <div className="flex items-start justify-between py-4 border-b border-border last:border-0">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{t("notificationSettings.studyReminders")}</p>
                <p className="text-sm text-muted-foreground">
                  Daily reminders to start your review session
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notificationSettings.studyReminders}
                onChange={(e) =>
                  handleUpdate({ studyReminders: e.target.checked })
                }
                disabled={!notificationSettings.enabled}
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary disabled:opacity-50"></div>
            </label>
          </div>

          {/* Reminder Time */}
          {notificationSettings.studyReminders && (
            <div className="ml-8 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{t("notificationSettings.reminderTime")}</span>
                </div>
                <input
                  type="time"
                  value={notificationSettings.reminderTime}
                  onChange={(e) =>
                    handleUpdate({ reminderTime: e.target.value })
                  }
                  disabled={!notificationSettings.enabled}
                  className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {/* Due Date Reminders */}
          <div className="flex items-start justify-between py-4 border-b border-border last:border-0">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{t("notificationSettings.dueDateReminders")}</p>
                <p className="text-sm text-muted-foreground">
                  Notify when cards are due for review
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notificationSettings.dueDateReminders}
                onChange={(e) =>
                  handleUpdate({ dueDateReminders: e.target.checked })
                }
                disabled={!notificationSettings.enabled}
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary disabled:opacity-50"></div>
            </label>
          </div>

          {/* Sound Effects */}
          <div className="flex items-start justify-between py-4 border-b border-border last:border-0">
            <div className="flex items-start gap-3">
              {notificationSettings.soundEnabled ? (
                <Volume2 className="w-5 h-5 text-muted-foreground mt-0.5" />
              ) : (
                <VolumeX className="w-5 h-5 text-muted-foreground mt-0.5" />
              )}
              <div>
                <p className="font-medium">{t("notificationSettings.notificationSounds")}</p>
                <p className="text-sm text-muted-foreground">
                  Play sound with notifications
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notificationSettings.soundEnabled}
                onChange={(e) =>
                  handleUpdate({ soundEnabled: e.target.checked })
                }
                disabled={!notificationSettings.enabled}
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary disabled:opacity-50"></div>
            </label>
          </div>

          {/* Sound Picker & Volume */}
          {notificationSettings.soundEnabled && (
            <div className="ml-8 p-4 bg-muted/30 rounded-lg space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{t("notificationSettings.sound")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={notificationSettings.notificationSound || "default"}
                    onChange={(e) =>
                      handleUpdate({ notificationSound: e.target.value })
                    }
                    className="px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {NOTIFICATION_SOUND_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const soundId = (notificationSettings.notificationSound || "default") as NotificationSoundId;
                      if (soundId !== "none") {
                        const vol = notificationSettings.soundVolume ?? 0.5;
                        const filePath = NOTIFICATION_SOUND_FILES[soundId];
                        if (filePath) {
                          playFile(filePath, vol);
                        } else {
                          playNotificationDefaultTone(vol);
                        }
                      }
                    }}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="Preview sound"
                  >
                    <Play className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">{t("notificationSettings.volume")}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round((notificationSettings.soundVolume ?? 0.5) * 100)}
                  onChange={(e) =>
                    handleUpdate({ soundVolume: parseInt(e.target.value) / 100 })
                  }
                  className="w-32 accent-primary"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* UI Sound Effects (independent from notification sounds) */}
      <section>
        <h3 className="text-lg font-semibold mb-4">{t("notificationSettings.uiSoundEffects")}</h3>
        <div className="space-y-4">
          <div className="flex items-start justify-between py-4 border-b border-border last:border-0">
            <div className="flex items-start gap-3">
              <Volume2 className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{t("notificationSettings.uiSoundEffectsLabel")}</p>
                <p className="text-sm text-muted-foreground">
                  {hapticsSupported
                    ? t("notificationSettings.uiSoundEffectsDesc")
                    : t("notificationSettings.uiSoundEffectsDescNoHaptics")}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notificationSettings.feedbackSoundsEnabled ?? false}
                onChange={(e) =>
                  handleUpdate({ feedbackSoundsEnabled: e.target.checked })
                }
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {notificationSettings.feedbackSoundsEnabled && (
            <div className="ml-8 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">{t("notificationSettings.feedbackVolume")}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round((notificationSettings.feedbackVolume ?? 0.3) * 100)}
                  onChange={(e) =>
                    handleUpdate({ feedbackVolume: parseInt(e.target.value) / 100 })
                  }
                  className="w-32 accent-primary"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Additional Options */}
      <section>
        <h3 className="text-lg font-semibold mb-4">{t("notificationSettings.additionalOptions")}</h3>
        <div className="space-y-4">
          {/* Quiet Hours */}
          <div className="flex items-start justify-between py-4 border-b border-border last:border-0">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{t("notificationSettings.quietHours")}</p>
                <p className="text-sm text-muted-foreground">
                  Pause notifications during specific hours
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notificationSettings.quietHoursEnabled}
                onChange={(e) =>
                  handleUpdate({ quietHoursEnabled: e.target.checked })
                }
                disabled={!notificationSettings.enabled}
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary disabled:opacity-50"></div>
            </label>
          </div>

          {notificationSettings.quietHoursEnabled && (
            <div className="ml-8 p-4 bg-muted/30 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Start</span>
                <input
                  type="time"
                  value={notificationSettings.quietHoursStart || "22:00"}
                  onChange={(e) =>
                    handleUpdate({ quietHoursStart: e.target.value })
                  }
                  disabled={!notificationSettings.enabled}
                  className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">End</span>
                <input
                  type="time"
                  value={notificationSettings.quietHoursEnd || "08:00"}
                  onChange={(e) =>
                    handleUpdate({ quietHoursEnd: e.target.value })
                  }
                  disabled={!notificationSettings.enabled}
                  className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {/* Badge Count */}
          <div className="flex items-start justify-between py-4 border-b border-border last:border-0">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{t("notificationSettings.showBadgeCount")}</p>
                <p className="text-sm text-muted-foreground">
                  Display due card count on app icon/badge
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notificationSettings.showBadge}
                onChange={(e) => handleUpdate({ showBadge: e.target.checked })}
                disabled={!notificationSettings.enabled}
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </section>

      {/* Background Notifications (PWA only) */}
      {platform === "pwa" && (
        <section>
          <h3 className="text-lg font-semibold mb-4">{t("notificationSettings.backgroundReminders")}</h3>
          <BackgroundNotificationSettings
            enabled={notificationSettings.enabled}
            permission={permission}
          />
        </section>
      )}

      {/* Test Notification */}
      {permission === "granted" && notificationSettings.enabled && (
        <section>
          <h3 className="text-lg font-semibold mb-4">Test</h3>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">{t("notificationSettings.sendTest")}</p>
              <p className="text-sm text-muted-foreground">
                Verify your notification settings are working
              </p>
            </div>
            <button
              onClick={handleTestNotification}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                testNotificationSent
                  ? "bg-green-500 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {testNotificationSent ? "Sent!" : "Send Test"}
            </button>
          </div>
        </section>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm text-blue-600 dark:text-blue-400">
            <p className="font-medium mb-1">{t("notificationSettings.about")}</p>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>{t("notificationSettings.studyRemindersDaily")}</li>
              <li>{t("notificationSettings.dueDateNotify")}</li>
              <li>{t("notificationSettings.quietHoursPrevent")}</li>
              {platform === "pwa" && (
                <li>PWA notifications work even when the app is closed</li>
              )}
              {platform === "tauri" && (
                <li>Desktop notifications use your system's notification center</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
