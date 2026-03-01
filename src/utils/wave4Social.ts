import { createLearningItem, type LearningItem } from "../api/learning-items";

export interface CommunityDeck {
  id: string;
  title: string;
  description: string;
  cardCount: number;
  sourceUser: string;
  ratingAverage: number;
  ratingsCount: number;
  cards: Array<{ question: string; answer?: string; tags?: string[] }>;
  createdAt: string;
}

export interface StudyGroup {
  id: string;
  name: string;
  deckIds: string[];
  memberStats: Record<string, { reviews: number; retention: number }>;
}

export interface PublicProfileConfig {
  enabled: boolean;
  slug: string;
  fields: Array<"streak" | "cardsLearned" | "retentionRate" | "reviewsToday">;
}

const MARKETPLACE_KEY = "incrementum.community.marketplace";
const GROUPS_KEY = "incrementum.community.groups";
const PROFILE_KEY = "incrementum.community.public-profile";

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "");
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function listCommunityDecks(): CommunityDeck[] {
  return readJson<CommunityDeck[]>(MARKETPLACE_KEY, []);
}

export function publishCommunityDeck(input: Omit<CommunityDeck, "id" | "ratingAverage" | "ratingsCount" | "createdAt">): CommunityDeck {
  const next: CommunityDeck = {
    ...input,
    id: crypto.randomUUID(),
    ratingAverage: 0,
    ratingsCount: 0,
    createdAt: new Date().toISOString(),
  };
  const all = [next, ...listCommunityDecks()];
  writeJson(MARKETPLACE_KEY, all);
  return next;
}

export async function installCommunityDeck(deckId: string): Promise<number> {
  const deck = listCommunityDecks().find((entry) => entry.id === deckId);
  if (!deck) throw new Error("Deck not found");

  let created = 0;
  for (const card of deck.cards) {
    await createLearningItem({
      item_type: "flashcard",
      question: card.question,
      answer: card.answer,
      allow_duplicate: true,
    });
    created += 1;
  }
  return created;
}

export function rateCommunityDeck(deckId: string, rating: number): CommunityDeck {
  const normalized = Math.max(1, Math.min(5, Math.round(rating)));
  const decks = listCommunityDecks();
  const updated = decks.map((deck) => {
    if (deck.id !== deckId) return deck;
    const total = deck.ratingAverage * deck.ratingsCount + normalized;
    const count = deck.ratingsCount + 1;
    return {
      ...deck,
      ratingsCount: count,
      ratingAverage: total / count,
    };
  });
  writeJson(MARKETPLACE_KEY, updated);
  const deck = updated.find((entry) => entry.id === deckId);
  if (!deck) throw new Error("Deck not found after rating");
  return deck;
}

export function listStudyGroups(): StudyGroup[] {
  return readJson<StudyGroup[]>(GROUPS_KEY, []);
}

export function createStudyGroup(name: string): StudyGroup {
  const group: StudyGroup = {
    id: crypto.randomUUID(),
    name,
    deckIds: [],
    memberStats: {},
  };
  const groups = [group, ...listStudyGroups()];
  writeJson(GROUPS_KEY, groups);
  return group;
}

export function attachDeckToGroup(groupId: string, deckId: string): StudyGroup {
  const groups = listStudyGroups();
  const updated = groups.map((group) =>
    group.id === groupId ? { ...group, deckIds: Array.from(new Set([...group.deckIds, deckId])) } : group
  );
  writeJson(GROUPS_KEY, updated);
  const group = updated.find((entry) => entry.id === groupId);
  if (!group) throw new Error("Group not found");
  return group;
}

export function updateGroupMemberStats(groupId: string, memberId: string, reviews: number, retention: number): StudyGroup {
  const groups = listStudyGroups();
  const updated = groups.map((group) => {
    if (group.id !== groupId) return group;
    return {
      ...group,
      memberStats: {
        ...group.memberStats,
        [memberId]: { reviews, retention },
      },
    };
  });
  writeJson(GROUPS_KEY, updated);
  const group = updated.find((entry) => entry.id === groupId);
  if (!group) throw new Error("Group not found");
  return group;
}

export function getPublicProfileConfig(): PublicProfileConfig {
  return readJson<PublicProfileConfig>(PROFILE_KEY, {
    enabled: false,
    slug: "",
    fields: [],
  });
}

export function setPublicProfileConfig(config: PublicProfileConfig): PublicProfileConfig {
  writeJson(PROFILE_KEY, config);
  return config;
}

export function buildPublicProfileData(
  config: PublicProfileConfig,
  stats: { streak: number; cardsLearned: number; retentionRate: number; reviewsToday: number }
): Record<string, string | number | boolean> {
  if (!config.enabled) return { enabled: false };
  const output: Record<string, string | number | boolean> = {
    enabled: true,
    slug: config.slug,
  };
  for (const field of config.fields) {
    output[field] = stats[field];
  }
  return output;
}

export function cardsToCommunityDeckCards(cards: LearningItem[]) {
  return cards.map((card) => ({
    question: card.question,
    answer: card.answer,
    tags: card.tags,
  }));
}
