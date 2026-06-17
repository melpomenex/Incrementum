/**
 * Smart Queues Settings
 * Configure auto-refresh behavior for the review queue
 */

import { ArrowsClockwise, Brain } from "@phosphor-icons/react";
import { useI18n } from "../../lib/i18n";

interface SmartQueuesSettingsProps {
  settings: {
    autoRefresh: boolean;
    refreshInterval: number;
  };
  onUpdateSettings: (updates: Partial<SmartQueuesSettingsProps["settings"]>) => void;
}

export function SmartQueuesSettings({
  settings,
  onUpdateSettings,
}: SmartQueuesSettingsProps) {
  const { t } = useI18n();
  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t("settings.smartQueues")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("settings.smartQueuesDesc")}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Auto-Refresh Toggle */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <ArrowsClockwise className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("settings.autoRefresh")}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("settings.autoRefreshDesc")}
                </div>
              </div>
            </div>
            <button
              onClick={() => onUpdateSettings({ autoRefresh: !settings.autoRefresh })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.autoRefresh ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.autoRefresh ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Refresh Interval */}
        {settings.autoRefresh && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <ArrowsClockwise className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("settings.refreshInterval")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("settings.refreshIntervalDesc")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="15"
                max="300"
                step="15"
                value={settings.refreshInterval}
                onChange={(e) => onUpdateSettings({ refreshInterval: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
              />
              <div className="w-20 text-right">
                <span className="text-sm font-medium text-foreground">
                  {settings.refreshInterval < 60
                    ? `${settings.refreshInterval}s`
                    : `${Math.round(settings.refreshInterval / 60)}m`}
                </span>
              </div>
            </div>

            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>15 sec</span>
              <span>5 min</span>
            </div>
          </div>
        )}

        {/* Performance Note */}
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            <strong>{t("settings.tip")}:</strong> {t("settings.autoRefreshTip")}
          </p>
        </div>
      </div>
    </div>
  );
}
