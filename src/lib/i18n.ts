import { useSettingsStore } from "../stores/settingsStore";

export type SupportedLocale = "en" | "es" | "de";

type Dict = Record<string, string>;

const en: Dict = {
  "nav.continue": "Continue Reading",
  "nav.dashboard": "Dashboard",
  "nav.documents": "Documents",
  "nav.queue": "Queue",
  "nav.graph": "Knowledge Graph",
  "nav.analytics": "Statistics",
  "nav.settings": "Settings",
  "review.title": "Review",
  "review.subtitle": "Practice with spaced repetition",
  "review.undo": "Undo last",
  "review.sourceJump": "Source jump",
  "review.normal": "Normal",
  "review.cram": "Cram",
};

const es: Dict = {
  "nav.continue": "Seguir Leyendo",
  "nav.dashboard": "Panel",
  "nav.documents": "Documentos",
  "nav.queue": "Cola",
  "nav.graph": "Grafo de Conocimiento",
  "nav.analytics": "Estadísticas",
  "nav.settings": "Ajustes",
  "review.title": "Repaso",
  "review.subtitle": "Practica con repetición espaciada",
  "review.undo": "Deshacer",
  "review.sourceJump": "Ir a fuente",
  "review.normal": "Normal",
  "review.cram": "Intensivo",
};

const de: Dict = {
  "nav.continue": "Weiterlesen",
  "nav.dashboard": "Dashboard",
  "nav.documents": "Dokumente",
  "nav.queue": "Warteschlange",
  "nav.graph": "Wissensgraph",
  "nav.analytics": "Statistik",
  "nav.settings": "Einstellungen",
  "review.title": "Wiederholen",
  "review.subtitle": "Üben mit verteiltem Lernen",
  "review.undo": "Letztes rückgängig",
  "review.sourceJump": "Zur Quelle",
  "review.normal": "Normal",
  "review.cram": "Pauken",
};

const dictionaries: Record<SupportedLocale, Dict> = { en, es, de };

export function getCurrentLocale(): SupportedLocale {
  const language = useSettingsStore.getState().settings.general.language;
  if (language === "es" || language === "de") return language;
  return "en";
}

export function t(key: string): string {
  const locale = getCurrentLocale();
  return dictionaries[locale][key] || dictionaries.en[key] || key;
}

export function useI18n() {
  const language = useSettingsStore((state) => state.settings.general.language);
  const locale: SupportedLocale = language === "es" || language === "de" ? language : "en";
  const translate = (key: string) => dictionaries[locale][key] || dictionaries.en[key] || key;
  return { locale, t: translate };
}
