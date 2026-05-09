import { describe, it, expect } from "vitest";
import { podcastFeedSearch } from "../podcastSearch";
import type { PodcastFeed } from "../../api/podcast";

function makeFeed(overrides: Partial<PodcastFeed> = {}): PodcastFeed {
  return {
    id: "1",
    title: "Tech Talk",
    description: "A podcast about technology",
    imageUrl: null,
    author: "John Doe",
    language: null,
    link: null,
    feedUrl: "https://example.com/feed",
    lastFetched: null,
    subscribedAt: "2024-01-01",
    sortOrder: 0,
    episodeCount: 10,
    unplayedCount: 3,
    autoTranscribe: false,
    ...overrides,
  };
}

describe("podcastFeedSearch", () => {
  const feeds = [
    makeFeed({ id: "1", title: "Tech Talk", author: "John Doe", description: "A podcast about technology" }),
    makeFeed({ id: "2", title: "Science Hour", author: "Jane Smith", description: "Exploring the universe" }),
    makeFeed({ id: "3", title: "Cooking Show", author: "Chef Bob", description: "Recipes and kitchen tips" }),
    makeFeed({
      id: "4",
      title: "News Daily",
      author: "NPR",
      description: "<p>Latest <b>news</b> from around the world</p>",
    }),
  ];

  it("returns all feeds for empty query", () => {
    expect(podcastFeedSearch("", feeds)).toHaveLength(4);
    expect(podcastFeedSearch("   ", feeds)).toHaveLength(4);
  });

  it("matches on title", () => {
    const result = podcastFeedSearch("tech", feeds);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("matches on author", () => {
    const result = podcastFeedSearch("NPR", feeds);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("4");
  });

  it("matches on description", () => {
    const result = podcastFeedSearch("universe", feeds);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("is case-insensitive", () => {
    expect(podcastFeedSearch("TECH", feeds)).toHaveLength(1);
    expect(podcastFeedSearch("npr", feeds)).toHaveLength(1);
  });

  it("returns empty array when nothing matches", () => {
    expect(podcastFeedSearch("xyznonexistent", feeds)).toHaveLength(0);
  });

  it("strips HTML from description before matching", () => {
    const result = podcastFeedSearch("news", feeds);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("4");
  });

  it("does not match on HTML tag names", () => {
    const result = podcastFeedSearch("<p>", feeds);
    expect(result).toHaveLength(0);
  });

  it("handles feeds with null author and description", () => {
    const sparseFeeds = [
      makeFeed({ id: "1", title: "Test", author: null, description: "" }),
    ];
    expect(podcastFeedSearch("test", sparseFeeds)).toHaveLength(1);
    expect(podcastFeedSearch("nonexistent", sparseFeeds)).toHaveLength(0);
  });
});
