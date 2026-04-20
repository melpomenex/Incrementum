import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  computePriority,
  postponeElement,
  postponeAll,
  defaultPostponeConfig,
  type PostponeInput,

} from "../postpone";

const makeItem = (overrides: Partial<PostponeInput> = {}): PostponeInput => ({
  id: "item-1",
  type: "item",
  interval: 30,
  priority: 50,
  stability: 10,
  difficulty: 3,
  reviewCount: 5,
  lapses: 0,
  daysSinceReview: 15,
  ...overrides,
});

const makeTopic = (overrides: Partial<PostponeInput> = {}): PostponeInput => ({
  id: "doc-1",
  type: "topic",
  interval: 14,
  priority: 50,
  stability: 10,
  difficulty: 3,
  reviewCount: 5,
  lapses: 0,
  daysSinceReview: 14,
  ...overrides,
});

describe("computePriority", () => {
  test("mature easy item has low priority", () => {
    // High stability, low difficulty → low priority
    const p = computePriority(100, 1, 0);
    expect(p).toBeLessThan(40);
  });

  test("young hard item has high priority", () => {
    // Low stability, high difficulty → high priority
    const p = computePriority(3, 5, 2);
    expect(p).toBeGreaterThan(60);
  });

  test("priority is clamped to 0–100", () => {
    expect(computePriority(0, 1, 0)).toBeGreaterThanOrEqual(0);
    expect(computePriority(0, 1, 0)).toBeLessThanOrEqual(100);
    expect(computePriority(500, 5, 50)).toBeGreaterThanOrEqual(0);
    expect(computePriority(500, 5, 50)).toBeLessThanOrEqual(100);
  });

  test("lapses increase priority", () => {
    const without = computePriority(10, 3, 0);
    const withLapses = computePriority(10, 3, 5);
    expect(withLapses).toBeGreaterThan(without);
  });
});

describe("postponeElement — item", () => {
  test("high priority item gets significant increase", () => {
    // Priority 100 → scaledPriority = floor(100/100) = 1 → full scaling
    const item = makeItem({ priority: 100, interval: 30, daysSinceReview: 30 });
    const config = { ...defaultPostponeConfig, checkItemSkip: false };
    const result = postponeElement(item, config);

    expect(result.postponed).toBe(true);
    expect(result.increase).toBeGreaterThan(10);
    expect(result.newInterval).toBe(item.interval + result.increase);
  });

  test("low priority item gets minimal increase", () => {
    const item = makeItem({ priority: 30, interval: 10, daysSinceReview: 10 });
    const config = { ...defaultPostponeConfig, checkItemSkip: false };
    const result = postponeElement(item, config);

    expect(result.postponed).toBe(true);
    // priority 30 → scaledPriority = floor(30/100) = 0 → increase = 0 → clamped to min
    expect(result.increase).toBeGreaterThanOrEqual(defaultPostponeConfig.itemMinIncrease);
  });

  test("well-established item is skipped when eligible", () => {
    const item = makeItem({
      priority: 90,
      stability: 50,
      interval: 60,
      daysSinceReview: 60,
      reviewCount: 30,
    });
    const result = postponeElement(item, defaultPostponeConfig);

    expect(result.postponed).toBe(false);
    expect(result.increase).toBe(0);
  });

  test("struggling item is postponed when not eligible", () => {
    const item = makeItem({
      priority: 25,
      stability: 5,
      interval: 10,
      daysSinceReview: 10,
      reviewCount: 2,
    });
    const result = postponeElement(item, defaultPostponeConfig);

    expect(result.postponed).toBe(true);
    expect(result.increase).toBeGreaterThan(0);
  });

  test("increase is clamped to min/max", () => {
    const item = makeItem({ priority: 100, interval: 100, daysSinceReview: 100 });
    const config = {
      ...defaultPostponeConfig,
      checkItemSkip: false,
      itemMinIncrease: 5,
      itemMaxIncrease: 50,
      itemCap: 50,
    };
    const result = postponeElement(item, config);

    expect(result.increase).toBeLessThanOrEqual(50);
    expect(result.increase).toBeGreaterThanOrEqual(5);
  });

  test("increase is clamped to floor", () => {
    const item = makeItem({ priority: 10, interval: 10, daysSinceReview: 10 });
    const config = {
      ...defaultPostponeConfig,
      checkItemSkip: false,
      itemFloor: 3,
    };
    const result = postponeElement(item, config);

    expect(result.increase).toBeGreaterThanOrEqual(3);
  });
});

describe("postponeElement — topic", () => {
  test("document uses topic parameters", () => {
    const topic = makeTopic({ priority: 70, daysSinceReview: 14 });
    const config = {
      ...defaultPostponeConfig,
      checkTopicSkip: false,
      topicIncrease: 40,
      topicMaxIncrease: 200,
      topicCap: 180,
    };
    const result = postponeElement(topic, config);

    expect(result.postponed).toBe(true);
    expect(result.increase).toBeGreaterThan(0);
    expect(result.increase).toBeLessThanOrEqual(180);
  });

  test("recently reviewed topic is skipped", () => {
    const topic = makeTopic({
      priority: 80,
      reviewCount: 15,
      daysSinceReview: 5,
    });
    const result = postponeElement(topic, defaultPostponeConfig);

    expect(result.postponed).toBe(false);
  });

  test("document failing AND condition is postponed", () => {
    // Fails priority check, passes elapsed check → AND fails → postponed
    const topic = makeTopic({
      priority: 50,  // below topicPriorityMin=60
      reviewCount: 5,   // below topicRepMin=10
      daysSinceReview: 20, // above topicElapsedMin=14
    });
    const result = postponeElement(topic, defaultPostponeConfig);

    expect(result.postponed).toBe(true);
  });

  test("skipTopics flag always skips documents", () => {
    const topic = makeTopic({ priority: 20, daysSinceReview: 2 });
    const config = { ...defaultPostponeConfig, skipTopics: true };
    const result = postponeElement(topic, config);

    expect(result.postponed).toBe(false);
  });
});

describe("simple mode", () => {
  test("item uses linear interpolation", () => {
    const item = makeItem({ priority: 50, interval: 10 });
    const config = { ...defaultPostponeConfig, simpleMode: true };
    const result = postponeElement(item, config);

    expect(result.postponed).toBe(true);
    // Simple: increase = round((365 - 1) * 50 / 100) = 182, newInterval = 1 + 182 = 183
    expect(result.newInterval).toBe(183);
  });

  test("topic uses topic parameters for simple mode", () => {
    const topic = makeTopic({ priority: 50, interval: 5 });
    const config = { ...defaultPostponeConfig, simpleMode: true };
    const result = postponeElement(topic, config);

    expect(result.postponed).toBe(true);
    // Simple: increase = round((200 - 1) * 50 / 100) = 100, newInterval = 1 + 100 = 101
    expect(result.newInterval).toBe(101);
  });

  test("simple mode bypasses eligibility", () => {
    // Item with high stability would normally be skipped
    const item = makeItem({
      priority: 90,
      stability: 100,
      daysSinceReview: 60,
      reviewCount: 30,
    });
    const config = { ...defaultPostponeConfig, simpleMode: true };
    const result = postponeElement(item, config);

    expect(result.postponed).toBe(true);
  });
});

describe("randomization", () => {
  beforeEach(() => {
    vi.mock("math", () => ({ random: () => 0.5 }));
  });

  test("randomize=true produces different results across items (statistical)", () => {
    // With deterministic random, results will still vary due to different inputs
    // This is more of a sanity check that randomization path runs
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ id: `item-${i}`, priority: 80, interval: 30, daysSinceReview: 30 })
    );
    const config = { ...defaultPostponeConfig, checkItemSkip: false, randomize: true };
    const { results } = postponeAll(items, config);

    // All should be postponed
    expect(results.every((r) => r.postponed)).toBe(true);
    // All increases should be positive
    expect(results.every((r) => r.increase > 0)).toBe(true);
  });

  test("randomize=false produces deterministic results", () => {
    const item = makeItem({ priority: 80, interval: 30, daysSinceReview: 30 });
    const config = { ...defaultPostponeConfig, checkItemSkip: false, randomize: false };

    const r1 = postponeElement(item, config);
    const r2 = postponeElement(item, config);

    expect(r1.increase).toBe(r2.increase);
  });
});

describe("postponeAll", () => {
  test("returns correct stats for mixed eligibility", () => {
    const items = [
      // Struggling — will be postponed
      makeItem({ id: "1", priority: 25, stability: 5, daysSinceReview: 10, reviewCount: 2 }),
      makeItem({ id: "2", priority: 20, stability: 3, daysSinceReview: 5, reviewCount: 1 }),
      // Well-established — will be skipped
      makeItem({ id: "3", priority: 90, stability: 50, daysSinceReview: 60, reviewCount: 30 }),
      makeItem({ id: "4", priority: 80, stability: 40, daysSinceReview: 45, reviewCount: 20 }),
    ];

    const config = { ...defaultPostponeConfig, randomize: false };
    const { results: _results, stats } = postponeAll(items, config);

    expect(stats.totalItems).toBe(4);
    expect(stats.skippedCount).toBeGreaterThanOrEqual(1);
    expect(stats.postponedCount).toBeGreaterThanOrEqual(1);
    expect(stats.postponedCount + stats.skippedCount).toBe(4);
    expect(stats.totalIncrease).toBeGreaterThanOrEqual(0);
    expect(stats.averageIncrease).toBe(
      stats.postponedCount > 0 ? Math.round(stats.totalIncrease / stats.postponedCount) : 0
    );
  });

  test("empty input returns zero stats", () => {
    const { results: _results, stats } = postponeAll([], defaultPostponeConfig);

    expect(stats.totalItems).toBe(0);
    expect(stats.postponedCount).toBe(0);
    expect(stats.skippedCount).toBe(0);
    expect(stats.totalIncrease).toBe(0);
    expect(stats.averageIncrease).toBe(0);
    expect(results).toHaveLength(0);
  });

  test("all items skipped returns zero average", () => {
    const items = [
      makeItem({ id: "1", priority: 90, stability: 50, daysSinceReview: 60, reviewCount: 30 }),
      makeItem({ id: "2", priority: 80, stability: 40, daysSinceReview: 45, reviewCount: 20 }),
    ];

    const { stats } = postponeAll(items, defaultPostponeConfig);

    expect(stats.skippedCount).toBe(2);
    expect(stats.averageIncrease).toBe(0);
  });
});
