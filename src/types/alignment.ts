export interface SegmentCFIMap {
  segmentIndex: number;
  segmentText: string;
  startTime: number;
  endTime: number;
  cfi: string;
  chapterId: string;
  confidence: number;
}

export interface ChapterMatch {
  audioChapterIndex: number;
  audioChapterTitle: string;
  epubChapterHref: string;
  epubChapterLabel: string;
  confidence: number;
}

export interface AlignmentResult {
  audioDocId: string;
  epubDocId: string;
  chapterMatches: ChapterMatch[];
  segmentMappings: SegmentCFIMap[];
  matchRate: number;
  totalSegments: number;
  matchedSegments: number;
  createdAt: string;
}

export interface AlignmentWorkerInput {
  transcriptSegments: Array<{
    text: string;
    startTime: number;
    endTime: number;
  }>;
  audioChapters: Array<{
    title: string;
    startTime: number;
    endTime: number;
  }>;
  epubChapters: Array<{
    href: string;
    label: string;
    text: string;
  }>;
}

export interface AlignmentWorkerOutput {
  chapterMatches: ChapterMatch[];
  segmentMappings: SegmentCFIMap[];
  matchRate: number;
  totalSegments: number;
  matchedSegments: number;
}
