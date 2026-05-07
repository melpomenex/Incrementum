import { describe, it, expect } from "vitest";
import { scoreRssRelevance, type RssRelevanceInput, type RssClassifier } from "../rssRelevance";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<RssRelevanceInput> = {}): RssRelevanceInput {
  return {
    itemTitle: "Introduction to Rust Programming",
    itemAuthor: "Jane Doe",
    itemTags: ["rust", "programming", "systems"],
    feedId: "feed-1",
    feedTitle: "Systems Blog",
    pubDate: new Date().toISOString(), // now → full recency
    ...overrides,
  };
}

function makeClassifier(overrides: Partial<RssClassifier> = {}): RssClassifier {
  return {
    classifier_type: "tag",
    value: "rust",
    sentiment: "like",
    scope: "global",
    feed_id: "feed-1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreRssRelevance", () => {
  // -----------------------------------------------------------------------
  // Neutral baseline
  // -----------------------------------------------------------------------
  it("returns 0.5 when no classifiers are provided", () => {
    const result = scoreRssRelevance(makeInput(), []);
    expect(result).toBe(0.5);
  });

  it("returns neutral when classifiers don't match the item (only recency applies)", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "author", value: "Bob Smith", sentiment: "like" }),
      makeClassifier({ classifier_type: "tag", value: "cooking", sentiment: "dislike" }),
    ];
    const result = scoreRssRelevance(makeInput(), classifiers);
    // Classifiers don't match → 0.5 classifier + 0.5 tag + 1.0 recency
    // = 0.5*0.5 + 0.2*0.5 + 0.3*1.0 = 0.65
    expect(result).toBeCloseTo(0.65, 2);
  });

  it("ignores neutral-sentiment classifiers", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "tag", value: "rust", sentiment: "neutral" }),
    ];
    const result = scoreRssRelevance(makeInput(), classifiers);
    // Neutral classifier → ignored. Only recency affects score.
    expect(result).toBeCloseTo(0.65, 2);
  });

  // -----------------------------------------------------------------------
  // Classifier matching
  // -----------------------------------------------------------------------
  it("boosts score for a matching liked tag", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "tag", value: "rust", sentiment: "like" }),
    ];
    const result = scoreRssRelevance(makeInput(), classifiers);
    expect(result).toBeGreaterThan(0.5);
  });

  it("lowers score for a matching disliked tag", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "tag", value: "rust", sentiment: "dislike" }),
    ];
    const result = scoreRssRelevance(makeInput(), classifiers);
    expect(result).toBeLessThan(0.5);
  });

  it("matches author case-insensitively (exact)", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "author", value: "jane doe", sentiment: "like" }),
    ];
    const result = scoreRssRelevance(makeInput({ itemAuthor: "Jane Doe" }), classifiers);
    expect(result).toBeGreaterThan(0.5);
  });

  it("does NOT match author by substring", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "author", value: "Jane", sentiment: "like" }),
    ];
    const result = scoreRssRelevance(makeInput({ itemAuthor: "Jane Doe" }), classifiers);
    // Author is exact match only — "Jane" ≠ "Jane Doe"
    // Classifier no match → 0.65 from recency
    expect(result).toBeCloseTo(0.65, 2);
  });

  it("matches title by case-insensitive substring", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "title", value: "rust", sentiment: "like" }),
    ];
    const result = scoreRssRelevance(
      makeInput({ itemTitle: "Why Rust is Great" }),
      classifiers,
    );
    expect(result).toBeGreaterThan(0.5);
  });

  it("matches feed by feed_id", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "feed", value: "Systems Blog", sentiment: "like", feed_id: "feed-1" }),
    ];
    const result = scoreRssRelevance(makeInput({ feedId: "feed-1" }), classifiers);
    expect(result).toBeGreaterThan(0.5);
  });

  it("does not match feed when feed_id differs", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "feed", value: "Systems Blog", sentiment: "like", feed_id: "feed-2", scope: "feed" }),
    ];
    const result = scoreRssRelevance(makeInput({ feedId: "feed-1" }), classifiers);
    // Feed-scoped classifier doesn't apply → 0.65 from recency
    expect(result).toBeCloseTo(0.65, 2);
  });

  // -----------------------------------------------------------------------
  // Scope priority
  // -----------------------------------------------------------------------
  it("feed-scoped classifier only applies to its feed", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "tag", value: "rust", sentiment: "like", scope: "feed", feed_id: "feed-2" }),
    ];
    const result = scoreRssRelevance(makeInput({ feedId: "feed-1" }), classifiers);
    // Feed-scoped classifier doesn't apply → 0.65 from recency
    expect(result).toBeCloseTo(0.65, 2);
  });

  it("global classifier applies to all feeds", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "tag", value: "rust", sentiment: "like", scope: "global" }),
    ];
    const result = scoreRssRelevance(makeInput(), classifiers);
    expect(result).toBeGreaterThan(0.5);
  });

  it("folder-scoped classifier applies to all feeds", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "tag", value: "rust", sentiment: "like", scope: "folder" }),
    ];
    const result = scoreRssRelevance(makeInput(), classifiers);
    expect(result).toBeGreaterThan(0.5);
  });

  // -----------------------------------------------------------------------
  // Mixed like/dislike
  // -----------------------------------------------------------------------
  it("mixed like and dislike produce mid-range score", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "tag", value: "rust", sentiment: "like" }),
      makeClassifier({ classifier_type: "tag", value: "systems", sentiment: "dislike" }),
    ];
    const result = scoreRssRelevance(makeInput(), classifiers);
    // Should be close to 0.5 since one like and one dislike cancel out
    expect(result).toBeGreaterThan(0.3);
    expect(result).toBeLessThan(0.7);
  });

  // -----------------------------------------------------------------------
  // Recency
  // -----------------------------------------------------------------------
  it("brand-new article gets recency boost (near 1.0 recency sub-score)", () => {
    const result = scoreRssRelevance(makeInput({ pubDate: new Date().toISOString() }), []);
    // Only recency component with no classifiers: 0.3 * 1.0 + 0.2 * 0.5 + 0.5 * 0.5
    // But empty classifiers returns 0.5 early, so we need at least one classifier
    const classifiers = [
      makeClassifier({ classifier_type: "author", value: "no-match", sentiment: "like" }),
    ];
    const resultWithClassifiers = scoreRssRelevance(
      makeInput({ pubDate: new Date().toISOString() }),
      classifiers,
    );
    expect(resultWithClassifiers).toBeGreaterThan(0.5);
  });

  it("old article (> 7 days) gets lower recency", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "author", value: "no-match", sentiment: "like" }),
    ];
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date().toISOString();

    const oldScore = scoreRssRelevance(makeInput({ pubDate: oldDate }), classifiers);
    const recentScore = scoreRssRelevance(makeInput({ pubDate: recentDate }), classifiers);

    expect(oldScore).toBeLessThan(recentScore);
  });

  it("missing pubDate gives neutral recency (0.5)", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "author", value: "no-match", sentiment: "like" }),
    ];
    const noDate = scoreRssRelevance(makeInput({ pubDate: undefined }), classifiers);
    const withDate = scoreRssRelevance(
      makeInput({ pubDate: new Date().toISOString() }),
      classifiers,
    );
    expect(noDate).toBeLessThan(withDate);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  it("handles item with no author", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "author", value: "Jane Doe", sentiment: "like" }),
    ];
    const result = scoreRssRelevance(makeInput({ itemAuthor: undefined }), classifiers);
    // No author to match → 0.65 from recency
    expect(result).toBeCloseTo(0.65, 2);
  });

  it("handles item with no tags", () => {
    const classifiers = [
      makeClassifier({ classifier_type: "tag", value: "rust", sentiment: "like" }),
    ];
    const result = scoreRssRelevance(makeInput({ itemTags: [] }), classifiers);
    // Classifier still matches on title/author/etc., but tag freq is neutral
    expect(result).toBeGreaterThan(0.4);
  });

  it("score is clamped between 0 and 1", () => {
    // Many dislikes
    const classifiers = Array.from({ length: 20 }, (_, i) =>
      makeClassifier({ classifier_type: "tag", value: `disliked-${i}`, sentiment: "dislike" }),
    );
    // Make the item match all of them
    const input = makeInput({
      itemTags: classifiers.map((c) => c.value),
    });
    const result = scoreRssRelevance(input, classifiers);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("score is clamped between 0 and 1 with many likes", () => {
    const classifiers = Array.from({ length: 20 }, (_, i) =>
      makeClassifier({ classifier_type: "tag", value: `liked-${i}`, sentiment: "like" }),
    );
    const input = makeInput({
      itemTags: classifiers.map((c) => c.value),
    });
    const result = scoreRssRelevance(input, classifiers);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});
