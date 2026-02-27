export type AppSectionDestination = {
  id: string;
  label: string;
  aliases: string[];
  path: string;
};

export type SectionMatch = {
  section: AppSectionDestination;
  score: number;
};

export const APP_SECTION_DESTINATIONS: AppSectionDestination[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    aliases: ["home", "overview", "main"],
    path: "/dashboard",
  },
  {
    id: "documents",
    label: "Documents",
    aliases: ["library", "docs", "files"],
    path: "/documents",
  },
  {
    id: "queue",
    label: "Queue",
    aliases: ["reading queue", "todo", "list"],
    path: "/queue",
  },
  {
    id: "analytics",
    label: "Analytics",
    aliases: ["stats", "statistics", "progress"],
    path: "/analytics",
  },
  {
    id: "settings",
    label: "Settings",
    aliases: ["preferences", "prefs", "config", "configuration"],
    path: "/settings",
  },
];

function rankMatch(candidate: string, query: string): number {
  if (!candidate || !query) return 0;
  if (candidate === query) return 1;
  if (candidate.startsWith(query)) return 0.93;
  if (candidate.includes(query)) return 0.86;
  return 0;
}

export function findMatchingSections(query: string): SectionMatch[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const matches: SectionMatch[] = [];
  for (const section of APP_SECTION_DESTINATIONS) {
    const values = [section.id, section.label.toLowerCase(), section.path.toLowerCase(), ...section.aliases.map((alias) => alias.toLowerCase())];
    const best = values.reduce((max, candidate) => Math.max(max, rankMatch(candidate, normalized)), 0);
    if (best > 0) {
      matches.push({ section, score: best });
    }
  }

  return matches.sort((a, b) => b.score - a.score || a.section.label.localeCompare(b.section.label));
}
