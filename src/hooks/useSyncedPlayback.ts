/**
 * DEPRECATED: Segment finding is now in epubSync.ts's findActiveSegment().
 * Sync highlighting is handled directly in EPUBViewer.
 */

import { useState, useEffect, useRef } from "react";
import type { AlignmentResult, SegmentCFIMap } from "../types/alignment";

export function useSyncedPlayback(
  currentTime: number,
  alignmentResult: AlignmentResult | null
) {
  const [activeSegment, setActiveSegment] = useState<SegmentCFIMap | null>(null);
  const prevSegmentIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!alignmentResult || alignmentResult.segmentMappings.length === 0) {
      setActiveSegment(null);
      return;
    }

    const segments = alignmentResult.segmentMappings;
    let best: SegmentCFIMap | null = null;

    for (const seg of segments) {
      if (currentTime >= seg.startTime && currentTime <= seg.endTime) {
        best = seg;
        break;
      }
    }

    if (!best) {
      let closestDist = Infinity;
      for (const seg of segments) {
        const mid = (seg.startTime + seg.endTime) / 2;
        const dist = Math.abs(currentTime - mid);
        if (dist < closestDist) {
          closestDist = dist;
          best = seg;
        }
      }
    }

    if (best && best.segmentIndex !== prevSegmentIndex.current) {
      prevSegmentIndex.current = best.segmentIndex;
      setActiveSegment(best);
    }
  }, [currentTime, alignmentResult]);

  return { activeSegment };
}
