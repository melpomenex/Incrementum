import type { SupportedLocale } from "../../lib/i18n";

import handbookDe from "../../../docs/USER_HANDBOOK.de.md?raw";
import handbookEn from "../../../docs/USER_HANDBOOK.md?raw";
import handbookEs from "../../../docs/USER_HANDBOOK.es.md?raw";
import handbookFr from "../../../docs/USER_HANDBOOK.fr.md?raw";
import handbookJa from "../../../docs/USER_HANDBOOK.ja.md?raw";
import handbookZh from "../../../docs/USER_HANDBOOK.zh.md?raw";

const handbookByLocale: Record<SupportedLocale, string> = {
  en: handbookEn,
  zh: handbookZh,
  es: handbookEs,
  de: handbookDe,
  fr: handbookFr,
  ja: handbookJa,
};

function normalizeGeneratedMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/---(?=#{1,6})/g, "---\n\n")
    .replace(/^(#{1,6})([^#\s])/gm, "$1 $2");
}

// The settings page already renders a generated contents sidebar, so dropping the
// duplicated markdown TOC avoids stale translated anchors inside the document body.
export function stripEmbeddedTableOfContents(markdown: string): string {
  const normalized = normalizeGeneratedMarkdown(markdown);
  const start =
    normalized.match(/^## Table of Contents\s*\n\n/m) ||
    normalized.match(/^## 目录\s*\n\n/m) ||
    normalized.match(/^## Tabla de contenidos\s*\n\n/m) ||
    normalized.match(/^## Inhaltsverzeichnis\s*\n\n/m) ||
    normalized.match(/^## Table des matières\s*\n\n/m) ||
    normalized.match(/^## 目次\s*\n\n/m);
  if (!start || start.index == null) return normalized;

  const afterStart = normalized.slice(start.index + start[0].length);
  const nextHeadingIndex = afterStart.search(/\n##\s+/);
  if (nextHeadingIndex === -1) return normalized;

  return `${normalized.slice(0, start.index)}${afterStart.slice(nextHeadingIndex + 1)}`.trim() + "\n";
}

export function getHandbookMarkdown(locale: SupportedLocale): string {
  return stripEmbeddedTableOfContents(handbookByLocale[locale] || handbookEn);
}
