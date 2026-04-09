import { describe, expect, it } from "vitest";
import { getCurrentLocale, t } from "../i18n";
import { useSettingsStore } from "../../stores/settingsStore";
import { en } from "../i18n/locales/en";
import { zh } from "../i18n/locales/zh";
import { es } from "../i18n/locales/es";
import { de } from "../i18n/locales/de";
import { fr } from "../i18n/locales/fr";
import { ja } from "../i18n/locales/ja";

useSettingsStore.persist.setOptions({
  storage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  } as any,
});

const allLocales = { en, zh, es, de, fr, ja } as const;
const localeNames = { en: "English", zh: "Chinese", es: "Spanish", de: "German", fr: "French", ja: "Japanese" };

describe("i18n", () => {
  it("normalizes regional locales to supported base languages", () => {
    useSettingsStore.setState((state) => ({
      settings: {
        ...state.settings,
        general: {
          ...state.settings.general,
          language: "zh-CN",
        },
      },
    }));

    expect(getCurrentLocale()).toBe("zh");
    expect(t("review.title")).toBe("复习");
  });

  it("interpolates placeholders and falls back to english", () => {
    useSettingsStore.setState((state) => ({
      settings: {
        ...state.settings,
        general: {
          ...state.settings.general,
          language: "pt-BR",
        },
      },
    }));

    expect(getCurrentLocale()).toBe("en");
    expect(t("review.cutoffGuarantee", { count: 7 })).toContain("7");
  });

  it("every non-English locale has translations for all English keys", () => {
    const enKeys = Object.keys(en);
    for (const [locale, dict] of Object.entries(allLocales)) {
      if (locale === "en") continue;
      const localeKeys = Object.keys(dict);
      const missing = enKeys.filter((k) => !localeKeys.includes(k));
      if (missing.length > 0) {
        // Only report the first 5 missing keys for readability
        expect.fail(
          `${localeNames[locale as keyof typeof localeNames]} is missing ${missing.length} keys: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` ...and ${missing.length - 5} more` : ""}`
        );
      }
    }
  });
});
