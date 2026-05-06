import { useMemo } from "react";
import { useDocumentStore } from "../stores/documentStore";
import {
  buildTitleIndex,
  findCompanionFromIndex,
  type PairMatch,
  type TitleIndex,
  PAIR_AMBIGUOUS_DELTA,
} from "./documentPairing";
import type { Document } from "../types/document";

export interface CompanionResult {
  best: PairMatch | null;
  alternatives: PairMatch[];
}

export function useDocumentPairing() {
  const documents = useDocumentStore((s) => s.documents);

  const index: TitleIndex = useMemo(
    () => buildTitleIndex(documents),
    [documents]
  );

  function findCompanion(doc: Document): CompanionResult {
    const matches = findCompanionFromIndex(doc, index);
    if (matches.length === 0) return { best: null, alternatives: [] };

    const best = matches[0];
    const alternatives = matches.slice(1).filter(
      (m) => best.score - m.score <= PAIR_AMBIGUOUS_DELTA
    );
    return { best, alternatives };
  }

  return { findCompanion };
}
