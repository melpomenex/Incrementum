/**
 * DEPRECATED: This worker generates fake CFIs that don't work with epubjs.
 * Sync is now handled at runtime via DOM-based matching in EPUBViewer + epubSync.ts.
 * This file is kept for reference and will be removed in a future cleanup.
 */

import type {
  AlignmentWorkerInput,
  AlignmentWorkerOutput,
  ChapterMatch,
  SegmentCFIMap,
} from "../types/alignment";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s\n\r]+/g, " ").trim();
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

const CHAPTER_MATCH_THRESHOLD = 0.6;
const SEGMENT_MATCH_THRESHOLD = 0.4;

function matchChapters(
  audioChapters: AlignmentWorkerInput["audioChapters"],
  epubChapters: AlignmentWorkerInput["epubChapters"]
): ChapterMatch[] {
  const matches: ChapterMatch[] = [];

  for (let ai = 0; ai < audioChapters.length; ai++) {
    const audioTitle = normalize(audioChapters[ai].title);
    if (!audioTitle) continue;

    let bestScore = 0;
    let bestEpubIndex = -1;

    for (let ei = 0; ei < epubChapters.length; ei++) {
      const epubLabel = normalize(epubChapters[ei].label);
      if (!epubLabel) continue;
      const score = similarity(audioTitle, epubLabel);
      if (score > bestScore) {
        bestScore = score;
        bestEpubIndex = ei;
      }
    }

    if (bestScore >= CHAPTER_MATCH_THRESHOLD && bestEpubIndex >= 0) {
      matches.push({
        audioChapterIndex: ai,
        audioChapterTitle: audioChapters[ai].title,
        epubChapterHref: epubChapters[bestEpubIndex].href,
        epubChapterLabel: epubChapters[bestEpubIndex].label,
        confidence: bestScore,
      });
    }
  }

  return matches;
}

function findBestCFI(
  segmentText: string,
  chapterText: string,
  chapterHref: string
): { cfi: string; confidence: number } | null {
  const normalizedSegment = normalize(segmentText);
  if (!normalizedSegment || normalizedSegment.length < 10) return null;

  const paragraphs = chapterText.split(/\n{2,}|\r\n{2,}/).filter(p => p.trim().length > 20);
  if (paragraphs.length === 0) return null;

  let bestScore = 0;
  let bestIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = normalize(paragraphs[i]);
    if (!para) continue;

    if (para.includes(normalizedSegment.slice(0, Math.min(30, normalizedSegment.length)))) {
      const score = normalizedSegment.length / para.length;
      if (score > bestScore) {
        bestScore = Math.min(score, 1);
        bestIndex = i;
      }
      continue;
    }

    const sampleLen = Math.min(normalizedSegment.length, 80);
    const sample = normalizedSegment.slice(0, sampleLen);
    const score = similarity(sample, para.slice(0, sampleLen + 20));
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestScore < SEGMENT_MATCH_THRESHOLD) return null;

  return {
    cfi: `${chapterHref}!/body/para[${bestIndex + 1}]`,
    confidence: bestScore,
  };
}

function alignSegments(
  input: AlignmentWorkerInput,
  chapterMatches: ChapterMatch[]
): SegmentCFIMap[] {
  const mappings: SegmentCFIMap[] = [];

  const _chapterMap = new Map(chapterMatches.map(m => [m.audioChapterIndex, m]));

  for (let si = 0; si < input.transcriptSegments.length; si++) {
    const seg = input.transcriptSegments[si];
    if (!seg.text || seg.text.trim().length < 5) continue;

    let match: { cfi: string; confidence: number; chapterId: string } | null = null;

    for (const cm of chapterMatches) {
      const ac = input.audioChapters[cm.audioChapterIndex];
      if (!ac) continue;
      if (seg.startTime >= ac.startTime && seg.endTime <= ac.endTime) {
        const epubChapter = input.epubChapters.find(ec => ec.href === cm.epubChapterHref);
        if (epubChapter) {
          const result = findBestCFI(seg.text, epubChapter.text, epubChapter.href);
          if (result && (!match || result.confidence > match.confidence)) {
            match = { cfi: result.cfi, confidence: result.confidence, chapterId: cm.epubChapterHref };
          }
        }
        break;
      }
    }

    if (!match) {
      for (const epubChapter of input.epubChapters) {
        const result = findBestCFI(seg.text, epubChapter.text, epubChapter.href);
        if (result && (!match || result.confidence > match.confidence)) {
          match = { cfi: result.cfi, confidence: result.confidence, chapterId: epubChapter.href };
        }
      }
    }

    if (match) {
      mappings.push({
        segmentIndex: si,
        segmentText: seg.text,
        startTime: seg.startTime,
        endTime: seg.endTime,
        cfi: match.cfi,
        chapterId: match.chapterId,
        confidence: match.confidence,
      });
    }
  }

  return mappings;
}

self.onmessage = (e: MessageEvent<AlignmentWorkerInput>) => {
  const input = e.data;

  const chapterMatches = matchChapters(input.audioChapters, input.epubChapters);
  const segmentMappings = alignSegments(input, chapterMatches);

  const output: AlignmentWorkerOutput = {
    chapterMatches,
    segmentMappings,
    matchRate: input.transcriptSegments.length > 0
      ? segmentMappings.length / input.transcriptSegments.length
      : 0,
    totalSegments: input.transcriptSegments.length,
    matchedSegments: segmentMappings.length,
  };

  self.postMessage(output);
};
