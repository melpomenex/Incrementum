import type { Document } from "../types/document";

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

const STRIP_PATTERNS = [
  /\(audiobook\)/gi,
  /\(audio\s*book\)/gi,
  /\(unabridged\)/gi,
  /\(abridged\)/gi,
  /\(a\s*narrated\s*version\)/gi,
  /\b audiobook \b/gi,
  /\b unabridged \b/gi,
  /\b abridged \b/gi,
  /\[\s*audiobook\s*\]/gi,
  /\[\s*unabridged\s*\]/gi,
  /,\s*\d+(?:st|nd|rd|th)\s+edition\b/gi,
  /:\s*a\s+novel\b/gi,
];

function stripExtension(title: string): string {
  return title.replace(/\.(epub|mp3|m4b|m4a|aac|ogg|flac|opus|wav|pdf|html|md|txt)$/i, "");
}

export function normalizeTitleForMatching(title: string): string {
  let normalized = stripExtension(title);
  for (const pattern of STRIP_PATTERNS) {
    normalized = normalized.replace(pattern, "");
  }
  return normalized.trim().replace(/\s+/g, " ").toLowerCase();
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

export const PAIR_MATCH_THRESHOLD = 0.75;
export const PAIR_AMBIGUOUS_DELTA = 0.10;

export interface PairMatch {
  doc: Document;
  score: number;
}

export function findCompanionDoc(
  doc: Document,
  allDocs: Document[]
): PairMatch[] {
  const targetType: Document["fileType"] =
    doc.fileType === "audio" ? "epub" :
    doc.fileType === "epub" ? "audio" :
    null;

  if (!targetType) return [];

  const normalizedSource = normalizeTitleForMatching(doc.title);
  if (!normalizedSource) return [];

  const candidates: PairMatch[] = [];

  for (const candidate of allDocs) {
    if (candidate.id === doc.id) continue;
    if (candidate.fileType !== targetType) continue;
    if (candidate.isArchived) continue;

    const normalizedCandidate = normalizeTitleForMatching(candidate.title);
    if (!normalizedCandidate) continue;

    const score = similarity(normalizedSource, normalizedCandidate);
    if (score >= PAIR_MATCH_THRESHOLD) {
      candidates.push({ doc: candidate, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export interface TitleIndex {
  audioDocs: Array<{ doc: Document; normalized: string }>;
  epubDocs: Array<{ doc: Document; normalized: string }>;
}

export function buildTitleIndex(allDocs: Document[]): TitleIndex {
  const audioDocs: TitleIndex["audioDocs"] = [];
  const epubDocs: TitleIndex["epubDocs"] = [];

  for (const doc of allDocs) {
    if (doc.isArchived) continue;
    const normalized = normalizeTitleForMatching(doc.title);
    if (!normalized) continue;
    if (doc.fileType === "audio") {
      audioDocs.push({ doc, normalized });
    } else if (doc.fileType === "epub") {
      epubDocs.push({ doc, normalized });
    }
  }

  return { audioDocs, epubDocs };
}

export function findCompanionFromIndex(
  doc: Document,
  index: TitleIndex
): PairMatch[] {
  const targetType: Document["fileType"] =
    doc.fileType === "audio" ? "epub" :
    doc.fileType === "epub" ? "audio" :
    null;

  if (!targetType) return [];

  const normalizedSource = normalizeTitleForMatching(doc.title);
  if (!normalizedSource) return [];

  const pool = targetType === "epub" ? index.epubDocs : index.audioDocs;
  const candidates: PairMatch[] = [];

  for (const entry of pool) {
    if (entry.doc.id === doc.id) continue;
    const score = similarity(normalizedSource, entry.normalized);
    if (score >= PAIR_MATCH_THRESHOLD) {
      candidates.push({ doc: entry.doc, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}
