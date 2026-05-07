/**
 * RSS Relevance Scorer
 *
 * Lightweight client-side scoring engine for RSS feed items.
 * Uses classifier data (likes/dislikes on author, title keywords, tags, feeds)
 * to compute a relevance score between 0.0 and 1.0.
 *
 * This intentionally does NOT use the Rust embeddings-based relevance module —
 * it's a simple heuristic scorer that runs purely in TypeScript.
 */

export interface RssRelevanceInput {
  itemTitle: string;
  itemAuthor?: string;
  itemTags: string[];
  feedId: string;
  feedTitle?: string;
  /** ISO 8601 date string for recency scoring */
  pubDate?: string;
}

export interface RssClassifier {
  classifier_type: "author" | "title" | "tag" | "feed";
  value: string;
  sentiment: "like" | "dislike" | "neutral";
  scope: "feed" | "folder" | "global";
  feed_id?: string;
}

/** Weight constants — sum to 1.0 */
const CLASSIFIER_WEIGHT = 0.5;
const TAG_FREQUENCY_WEIGHT = 0.2;
const RECENCY_WEIGHT = 0.3;

/** How many days until recency score hits its floor */
const RECENCY_DECAY_DAYS = 7;

/** Recency floor (articles older than DECAY_DAYS get this minimum) */
const RECENCY_FLOOR = 0.3;

/**
 * Score a single RSS item against a set of classifiers.
 *
 * Returns a value between 0.0 and 1.0, with 0.5 being neutral.
 *
 * Three sub-scores:
 *  1. Classifier match (weight 0.5) — direct like/dislike signals
 *  2. Tag frequency   (weight 0.2) — boost for tags that appear on liked items
 *  3. Recency         (weight 0.3) — linear decay over 7 days, floor at 0.3
 */
export function scoreRssRelevance(
  input: RssRelevanceInput,
  classifiers: RssClassifier[],
): number {
  if (classifiers.length === 0) {
    return 0.5;
  }

  const classifierScore = computeClassifierScore(input, classifiers);
  const tagScore = computeTagFrequencyScore(input, classifiers);
  const recencyScore = computeRecencyScore(input.pubDate);

  const total =
    classifierScore * CLASSIFIER_WEIGHT +
    tagScore * TAG_FREQUENCY_WEIGHT +
    recencyScore * RECENCY_WEIGHT;

  return clamp(total, 0, 1);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a classifier applies to the given feed.
 *
 * Priority: feed-scoped (matching feed_id) > folder-scoped > global.
 */
function classifierApplies(
  classifier: RssClassifier,
  feedId: string,
): boolean {
  if (classifier.scope === "feed") {
    return classifier.feed_id === feedId;
  }
  // folder and global scope always apply
  return true;
}

/**
 * Check if the item matches a single classifier.
 */
function itemMatchesClassifier(
  input: RssRelevanceInput,
  classifier: RssClassifier,
): boolean {
  const needle = classifier.value.toLowerCase();
  const type = classifier.classifier_type;

  switch (type) {
    case "author": {
      if (!input.itemAuthor) return false;
      return input.itemAuthor.toLowerCase() === needle;
    }
    case "title": {
      return input.itemTitle.toLowerCase().includes(needle);
    }
    case "tag": {
      return input.itemTags.some(
        (tag) => tag.toLowerCase() === needle,
      );
    }
    case "feed": {
      return (
        input.feedId === classifier.feed_id ||
        (input.feedTitle?.toLowerCase() ?? "") === needle
      );
    }
    default:
      return false;
  }
}

/**
 * Compute the classifier-based sub-score (0.0 – 1.0).
 *
 * For each applicable classifier that matches the item:
 *  - "like"   → +1 signal
 *  - "dislike" → −1 signal
 *
 * Normalised so that if there are only positive signals the score is 1.0,
 * only negative → 0.0, and a mix interpolates.  No signals → 0.5.
 *
 * Feed-scoped classifiers are counted twice (they're more specific).
 */
function computeClassifierScore(
  input: RssRelevanceInput,
  classifiers: RssClassifier[],
): number {
  let likeSum = 0;
  let dislikeSum = 0;

  for (const c of classifiers) {
    if (c.sentiment === "neutral") continue;
    if (!classifierApplies(c, input.feedId)) continue;
    if (!itemMatchesClassifier(input, c)) continue;

    const weight = c.scope === "feed" ? 2 : 1;

    if (c.sentiment === "like") {
      likeSum += weight;
    } else {
      dislikeSum += weight;
    }
  }

  if (likeSum === 0 && dislikeSum === 0) {
    return 0.5; // no signal → neutral
  }

  const total = likeSum + dislikeSum;
  return clamp(likeSum / total, 0, 1);
}

/**
 * Compute tag-frequency sub-score (0.0 – 1.0).
 *
 * Checks if any of the item's tags appear as "like" tag classifiers.
 * Score = fraction of item tags that are liked (0 = none liked, 1 = all liked).
 * If no liked tag classifiers exist, returns 0.5 (no signal).
 */
function computeTagFrequencyScore(
  input: RssRelevanceInput,
  classifiers: RssClassifier[],
): number {
  if (input.itemTags.length === 0) {
    return 0.5;
  }

  // Collect all tags that have a "like" sentiment (from applicable classifiers)
  const likedTags = new Set<string>();
  for (const c of classifiers) {
    if (
      c.classifier_type === "tag" &&
      c.sentiment === "like" &&
      classifierApplies(c, input.feedId)
    ) {
      likedTags.add(c.value.toLowerCase());
    }
  }

  if (likedTags.size === 0) {
    return 0.5; // no liked tags → no signal
  }

  const matchCount = input.itemTags.filter((tag) =>
    likedTags.has(tag.toLowerCase()),
  ).length;

  return matchCount / input.itemTags.length;
}

/**
 * Compute recency sub-score (0.3 – 1.0).
 *
 * Within 24 h → 1.0
 * Linear decay to RECENCY_FLOOR over RECENCY_DECAY_DAYS
 * Missing date → 0.5 (no signal)
 */
function computeRecencyScore(pubDate?: string): number {
  if (!pubDate) {
    return 0.5;
  }

  const pubTime = Date.parse(pubDate);
  if (Number.isNaN(pubTime)) {
    return 0.5;
  }

  const ageMs = Date.now() - pubTime;
  const ageHours = ageMs / (1000 * 60 * 60);

  // Within 24 hours → full score
  if (ageHours <= 24) {
    return 1.0;
  }

  const ageDays = ageHours / 24;

  // Beyond decay window → floor
  if (ageDays >= RECENCY_DECAY_DAYS) {
    return RECENCY_FLOOR;
  }

  // Linear interpolation between 1.0 (at 1 day) and FLOOR (at DECAY_DAYS)
  const t = (ageDays - 1) / (RECENCY_DECAY_DAYS - 1);
  return 1.0 - t * (1.0 - RECENCY_FLOOR);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
