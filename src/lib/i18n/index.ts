import { useSettingsStore } from "../../stores/settingsStore";

export type { Dict } from "./locales/en";

export type SupportedLocale = "en" | "zh" | "es" | "de" | "fr" | "ja";

import type { Dict } from "./locales/en";
import { en } from "./locales/en";
import { zh } from "./locales/zh";
import { es } from "./locales/es";
import { de } from "./locales/de";
import { fr } from "./locales/fr";
import { ja } from "./locales/ja";

const dictionaries: Record<SupportedLocale, Dict> = { en, zh, es, de, fr, ja };

function normalizeLocale(input?: string | null): SupportedLocale {
  const value = String(input || "en").trim().toLowerCase();
  const base = value.split(/[-_]/)[0];
  if (base === "zh") return "zh";
  if (base === "es") return "es";
  if (base === "de") return "de";
  if (base === "fr") return "fr";
  if (base === "ja") return "ja";
  return "en";
}

function formatTemplate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

export function getCurrentLocale(): SupportedLocale {
  const language = useSettingsStore.getState().settings.general.language;
  return normalizeLocale(language);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const locale = getCurrentLocale();
  const template = dictionaries[locale][key] || dictionaries.en[key] || key;
  return formatTemplate(template, vars);
}

export function useI18n() {
  const language = useSettingsStore((state) => state.settings.general.language);
  const locale = normalizeLocale(language);
  const translate = (key: string, vars?: Record<string, string | number>) => {
    const template = dictionaries[locale][key] || dictionaries.en[key] || key;
    return formatTemplate(template, vars);
  };
  return { locale, t: translate };
}
