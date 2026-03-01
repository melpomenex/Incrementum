export type ReadingDocType = "pdf" | "epub" | "markdown" | "html" | "youtube" | "audio" | "video" | "other";

export interface ReadingSession {
  id: string;
  timestamp: string;
  docType: ReadingDocType;
  wordsRead: number;
  minutesSpent: number;
}

const STORAGE_KEY = "incrementum.reading-sessions";

export function recordReadingSession(entry: Omit<ReadingSession, "id" | "timestamp">): ReadingSession {
  const session: ReadingSession = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const current = getReadingSessions();
  const next = [session, ...current].slice(0, 1000);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return session;
}

export function getReadingSessions(): ReadingSession[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getReadingSpeedByType(docType: ReadingDocType): number {
  const sessions = getReadingSessions().filter((entry) => entry.docType === docType && entry.minutesSpent > 0);
  if (sessions.length === 0) return 200;
  const totalWords = sessions.reduce((sum, entry) => sum + entry.wordsRead, 0);
  const totalMinutes = sessions.reduce((sum, entry) => sum + entry.minutesSpent, 0);
  if (!totalMinutes) return 200;
  return totalWords / totalMinutes;
}

export function estimateMinutesForWords(words: number, docType: ReadingDocType): number {
  const wpm = getReadingSpeedByType(docType);
  return words > 0 ? words / Math.max(40, wpm) : 0;
}
