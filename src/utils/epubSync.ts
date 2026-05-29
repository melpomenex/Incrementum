export interface SyncSegment {
  index: number;
  text: string;
  startTime: number;
  endTime: number;
}

interface TextNodeEntry {
  node: Text;
  text: string;
}

interface CharMapping {
  nodeIdx: number;
  charIdx: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/[\s\n\r]+/g, " ")
    .trim();
}

function extractTextNodes(contents: any): TextNodeEntry[] {
  const doc = contents?.document;
  const body = doc?.body;
  if (!body) return [];

  const entries: TextNodeEntry[] = [];
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.nodeValue ?? "";
    if (text.trim()) {
      entries.push({ node, text });
    }
  }

  return entries;
}

function buildNormalizedText(entries: TextNodeEntry[]): {
  text: string;
  mapping: CharMapping[];
} {
  let text = "";
  const mapping: CharMapping[] = [];

  for (let ni = 0; ni < entries.length; ni++) {
    const nodeText = entries[ni].text;
    for (let ci = 0; ci < nodeText.length; ci++) {
      const ch = nodeText[ci];
      if (/[a-zA-Z0-9]/.test(ch)) {
        text += ch.toLowerCase();
        mapping.push({ nodeIdx: ni, charIdx: ci });
      } else if (/\s/.test(ch)) {
        if (text.length === 0 || text[text.length - 1] !== " ") {
          text += " ";
          mapping.push({ nodeIdx: ni, charIdx: ci });
        }
      }
    }
  }

  return { text, mapping };
}

function findMatch(
  chapterText: string,
  segmentText: string,
  searchFrom: number
): { start: number; end: number; confidence: number } | null {
  const normSeg = normalize(segmentText);
  if (normSeg.length < 10) return null;

  // 1. Exact substring match
  let idx = chapterText.indexOf(normSeg, searchFrom);
  if (idx !== -1) {
    return { start: idx, end: idx + normSeg.length - 1, confidence: 1.0 };
  }

  idx = chapterText.indexOf(normSeg);
  if (idx !== -1) {
    return { start: idx, end: idx + normSeg.length - 1, confidence: 0.9 };
  }

  // 2. Match by prefix (first 20-40 chars)
  const prefix = normSeg.slice(0, Math.min(40, normSeg.length)).trim();
  if (prefix.length >= 15) {
    idx = chapterText.indexOf(prefix, searchFrom);
    if (idx !== -1) {
      return { start: idx, end: Math.min(idx + normSeg.length - 1, chapterText.length - 1), confidence: 0.7 };
    }
    idx = chapterText.indexOf(prefix);
    if (idx !== -1) {
      return { start: idx, end: Math.min(idx + normSeg.length - 1, chapterText.length - 1), confidence: 0.6 };
    }
  }

  // 3. Match by first few significant words
  const words = normSeg.split(/\s+/).filter((w) => w.length >= 4);
  if (words.length >= 2) {
    const phrase = words.slice(0, 3).join(" ");
    idx = chapterText.indexOf(phrase, searchFrom);
    if (idx !== -1) {
      return { start: idx, end: Math.min(idx + normSeg.length - 1, chapterText.length - 1), confidence: 0.5 };
    }
    idx = chapterText.indexOf(phrase);
    if (idx !== -1) {
      return { start: idx, end: Math.min(idx + normSeg.length - 1, chapterText.length - 1), confidence: 0.4 };
    }
  }

  return null;
}

function offsetsToCfi(
  entries: TextNodeEntry[],
  mapping: CharMapping[],
  startOffset: number,
  endOffset: number,
  contents: any
): string | null {
  if (startOffset >= mapping.length || endOffset >= mapping.length) return null;
  if (startOffset > endOffset) return null;

  const startPos = mapping[startOffset];
  const endPos = mapping[endOffset];

  try {
    const doc = contents.document;
    const range = doc.createRange();
    range.setStart(entries[startPos.nodeIdx].node, startPos.charIdx);
    range.setEnd(entries[endPos.nodeIdx].node, endPos.charIdx + 1);
    const cfi = contents.cfiFromRange?.(range);
    range.detach?.();
    return cfi ? String(cfi) : null;
  } catch {
    return null;
  }
}

const MIN_CONFIDENCE = 0.4;

export function buildSegmentCfiMap(
  contents: any,
  segments: SyncSegment[]
): Map<number, string> {
  const map = new Map<number, string>();
  if (!segments.length) return map;

  const entries = extractTextNodes(contents);
  if (!entries.length) return map;

  const { text: chapterText, mapping } = buildNormalizedText(entries);
  if (!chapterText) return map;

  let searchFrom = 0;

  for (const segment of segments) {
    const match = findMatch(chapterText, segment.text, searchFrom);
    if (!match || match.confidence < MIN_CONFIDENCE) continue;

    const cfi = offsetsToCfi(entries, mapping, match.start, match.end, contents);
    if (cfi) {
      map.set(segment.index, cfi);
      searchFrom = match.end;
    }
  }

  return map;
}

export function findActiveSegment(
  segments: SyncSegment[],
  currentTime: number
): SyncSegment | null {
  for (const seg of segments) {
    if (currentTime >= seg.startTime && currentTime <= seg.endTime) {
      return seg;
    }
  }

  // Fallback: closest segment within 3 seconds
  let closest: SyncSegment | null = null;
  let minDist = Infinity;
  for (const seg of segments) {
    const mid = (seg.startTime + seg.endTime) / 2;
    const dist = Math.abs(currentTime - mid);
    if (dist < minDist) {
      minDist = dist;
      closest = seg;
    }
  }

  return closest && minDist < 3 ? closest : null;
}
