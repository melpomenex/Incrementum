import type { StudyDeck } from "../types/study-decks";

const normalize = (value: string) => value.trim().toLowerCase();

export function normalizeTagList(tags: string[]): string[] {
  const seen = new Map<string, string>();
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const key = normalize(trimmed);
    if (!seen.has(key)) {
      seen.set(key, trimmed);
    }
  }
  return Array.from(seen.values());
}

export function matchesDeckTags(tags: string[], deck: StudyDeck | null): boolean {
  if (!deck) return true;
  if (!tags || tags.length === 0) return false;
  if (!deck.tagFilters || deck.tagFilters.length === 0) return false;

  const tagSet = new Set(tags.map((tag) => normalize(tag)));
  for (const filter of deck.tagFilters) {
    if (tagSet.has(normalize(filter))) {
      return true;
    }
  }
  return false;
}

export function matchesDeck<T extends { tags: string[]; document_id?: string }>(
  item: T,
  deck: StudyDeck | null
): boolean {
  if (!deck) return true;
  if (deck.documentId && item.document_id && deck.documentId !== item.document_id) return false;
  return matchesDeckTags(item.tags, deck);
}

export function filterByDeck<T extends { tags: string[]; document_id?: string }>(
  items: T[],
  deck: StudyDeck | null
): T[] {
  if (!deck) return items;
  return items.filter((item) => matchesDeck(item, deck));
}

export function filterByDecks<T extends { tags: string[]; document_id?: string }>(
  items: T[],
  decks: StudyDeck[]
): T[] {
  if (decks.length === 0) return items;
  return items.filter((item) => decks.some((deck) => matchesDeck(item, deck)));
}

export function getDeckTagCandidates(tags: string[]): string[] {
  return tags
    .filter((tag) => tag && tag.trim().length > 0)
    .filter((tag) => normalize(tag) !== "anki-import")
    .map((tag) => tag.trim());
}
