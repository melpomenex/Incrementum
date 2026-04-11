import { useSettingsStore } from "../stores";
import { useEffect } from "react";
import { useI18n } from "../lib/i18n";

export function Settings() {
  const { t } = useI18n();
  const { settings, updateSettings } = useSettingsStore();

  useEffect(() => {
    // Apply theme to document
    const root = document.documentElement;
    if (settings.theme === "dark" || (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [settings.theme]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">{t("settings.title")}</h1>
        <p className="text-muted-foreground">
          {t("settingsLegacy.customizeExperience")}
        </p>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">{t("settings.appearance")}</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">{t("settings.theme")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("settingsLegacy.chooseColorScheme")}
                </div>
              </div>
              <select
                value={settings.theme}
                onChange={(e) => updateSettings({ theme: e.target.value as any })}
                className="px-3 py-2 bg-background border border-border rounded-md text-foreground"
              >
                <option value="light">{t("settingsLegacy.light")}</option>
                <option value="dark">{t("settingsLegacy.dark")}</option>
                <option value="system">{t("settingsLegacy.system")}</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">{t("settings.fontSize")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("settings.fontSizeDesc")}
                </div>
              </div>
              <input
                type="number"
                min="10"
                max="20"
                value={settings.fontSize}
                onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                className="w-20 px-3 py-2 bg-background border border-border rounded-md text-foreground"
              />
            </div>
          </div>
        </div>

        {/* Review Settings */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">{t("settingsLegacy.reviewSettings")}</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">{t("settings.algorithm")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("settingsLegacy.spacedRepetitionAlgorithm")}
                </div>
              </div>
              <select
                value={settings.learning.algorithm}
                onChange={(e) => updateSettings({ learning: { ...settings.learning, algorithm: e.target.value as any } })}
                className="px-3 py-2 bg-background border border-border rounded-md text-foreground"
              >
                <option value="fsrs">{t("settingsLegacy.fsrsRecommended")}</option>
                <option value="sm18">SuperMemo 18</option>
                <option value="sm20">SuperMemo 20</option>
                <option value="sm15">SuperMemo 15</option>
                <option value="sm8">SuperMemo 8</option>
                <option value="sm5">SuperMemo 5</option>
                <option value="sm2">SuperMemo 2</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">{t("settingsLegacy.newCardsPerDay")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("settingsLegacy.maxNewCards")}
                </div>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.newCardsPerDay}
                onChange={(e) => updateSettings({ newCardsPerDay: Number(e.target.value) })}
                className="w-20 px-3 py-2 bg-background border border-border rounded-md text-foreground"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">{t("settingsLegacy.reviewsPerDay")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("settingsLegacy.maxReviews")}
                </div>
              </div>
              <input
                type="number"
                min="0"
                max="500"
                value={settings.reviewsPerDay}
                onChange={(e) => updateSettings({ reviewsPerDay: Number(e.target.value) })}
                className="w-20 px-3 py-2 bg-background border border-border rounded-md text-foreground"
              />
            </div>
          </div>
        </div>

        {/* Import Settings */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">{t("settingsLegacy.importSettings")}</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">{t("settingsLegacy.autoImport")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("settingsLegacy.autoImportDesc")}
                </div>
              </div>
              <button
                onClick={() => updateSettings({ autoImport: !settings.autoImport })}
                className={`
                  w-12 h-6 rounded-full transition-colors relative
                  ${settings.autoImport ? "bg-primary" : "bg-muted"}
                `}
              >
                <div
                  className={`
                    w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all
                    ${settings.autoImport ? "left-6" : "left-0.5"}
                  `}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">{t("settingsLegacy.defaultCategory")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("settingsLegacy.defaultCategoryDesc")}
                </div>
              </div>
              <input
                type="text"
                value={settings.defaultCategory}
                onChange={(e) => updateSettings({ defaultCategory: e.target.value })}
                className="w-48 px-3 py-2 bg-background border border-border rounded-md text-foreground"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
