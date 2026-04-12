/**
 * Postpone Engine
 *
 * Algorithm-aware postponement for spaced repetition items, modeled after
 * SuperMemo 20's postpone system (reverse-engineered from sm20.exe via Ghidra).
 *
 * Items with lower stability and higher difficulty receive smaller postponement
 * increases (they're struggling, so we don't want to push them too far out).
 * Well-established items (high stability, low difficulty) get larger increases.
 *
 * Documents are treated as "topics" in the SM-20 model.
 */

// =============================================================================
// Types
// =============================================================================

export interface PostponeConfig {
  // Item parameters
  itemIncrease: number;      // percentage (e.g., 50 = 50% increase)
  itemMinIncrease: number;   // minimum days to add
  itemMaxIncrease: number;   // maximum days to add
  itemCap: number;           // absolute upper bound on increase
  itemFloor: number;         // absolute lower bound on increase
  itemBase?: number;         // base interval for simple mode (default 1)
  itemMin?: number;          // min interval for simple mode (default 1)
  itemMax?: number;          // max interval for simple mode (default 365)

  // Topic (document) parameters
  topicIncrease: number;
  topicMinIncrease: number;
  topicMaxIncrease: number;
  topicCap: number;
  topicFloor: number;
  topicBase?: number;        // base interval for simple mode (default 1)
  topicMin?: number;         // min interval for simple mode (default 1)
  topicMax?: number;         // max interval for simple mode (default 200)

  // Item eligibility thresholds
  minElapsed: number;        // min days since last review
  minPriority: number;       // min priority to be eligible for skipping
  minPriority2: number;      // secondary priority threshold
  minStability: number;      // min stability to be eligible for skipping

  // Topic eligibility thresholds
  topicPriorityMin: number;
  topicRepMin: number;
  topicElapsedMin: number;

  // Behavior toggles
  randomize: boolean;
  simpleMode: boolean;
  checkItemSkip: boolean;    // enable item eligibility checks
  checkTopicSkip: boolean;   // enable topic eligibility checks
  skipTopics: boolean;       // if true, always skip documents
  topicMinSkip?: number;     // minimum interval when skipping topics
}

export interface PostponeInput {
  id: string;
  type: "item" | "topic";
  interval: number;           // current interval in days
  priority: number;           // 0–100
  stability: number;
  difficulty: number;         // 1–5
  reviewCount: number;
  lapses: number;
  daysSinceReview: number;    // days since last repetition
}

export interface PostponeResult {
  id: string;
  postponed: boolean;         // false if item was skipped (already well-established)
  increase: number;           // days added to interval
  newInterval: number;        // resulting interval
  ratio: number;              // (old_interval + increase) / old_interval
}

export interface PostponeStats {
  totalItems: number;
  postponedCount: number;
  skippedCount: number;
  totalIncrease: number;
  averageIncrease: number;
}

// =============================================================================
// Defaults
// =============================================================================

export const defaultPostponeConfig: PostponeConfig = {
  itemIncrease: 50,
  itemMinIncrease: 1,
  itemMaxIncrease: 365,
  itemCap: 365,
  itemFloor: 1,
  itemBase: 1,
  itemMin: 1,
  itemMax: 365,

  topicIncrease: 40,
  topicMinIncrease: 1,
  topicMaxIncrease: 200,
  topicCap: 180,
  topicFloor: 1,
  topicBase: 1,
  topicMin: 1,
  topicMax: 200,

  minElapsed: 30,
  minPriority: 50,
  minPriority2: 60,
  minStability: 30,

  topicPriorityMin: 60,
  topicRepMin: 10,
  topicElapsedMin: 14,

  randomize: true,
  simpleMode: false,
  checkItemSkip: true,
  checkTopicSkip: true,
  skipTopics: false,
  topicMinSkip: 1,
};

// =============================================================================
// Priority Computation
// =============================================================================

/**
 * Derive a priority value (0–100) from item state.
 * Higher stability and lower difficulty = lower priority (well-established).
 * Lower stability and higher difficulty = higher priority (struggling).
 */
export function computePriority(
  stability: number,
  difficulty: number,
  lapses: number
): number {
  const difficultyFactor = (difficulty - 1) * 0.15 + 0.7; // maps 1→0.7, 5→1.3
  const lapsesPenalty = Math.min(lapses * 2, 20);
  const raw = 100 - (stability * difficultyFactor) + lapsesPenalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// =============================================================================
// Simple Postpone (linear interpolation by priority, no eligibility checks)
// =============================================================================

function simplePostpone(input: PostponeInput, config: PostponeConfig): PostponeResult {
  const { type, priority, interval } = input;
  let increase: number;
  let newInterval: number;

  if (type === "item") {
    const base = config.itemBase ?? 1;
    const min = config.itemMin ?? 1;
    const max = config.itemMax ?? 365;
    const range = max - min;
    increase = Math.round((range * priority) / 100);
    newInterval = base + increase;
  } else {
    const base = config.topicBase ?? 1;
    const min = config.topicMin ?? 1;
    const max = config.topicMax ?? 200;
    const range = max - min;
    increase = Math.round((range * priority) / 100);
    newInterval = base + increase;
  }

  newInterval = Math.max(0, Math.min(65535, newInterval));
  increase = newInterval - interval;
  const ratio = interval > 0 ? (interval + increase) / interval : 1.01;

  return {
    id: input.id,
    postponed: true,
    increase,
    newInterval,
    ratio,
  };
}

// =============================================================================
// Eligibility Checks
// =============================================================================

function isItemEligibleForSkip(input: PostponeInput, config: PostponeConfig): boolean {
  return (
    input.daysSinceReview >= config.minElapsed &&
    input.priority >= config.minPriority &&
    (input.priority >= config.minPriority2 ||
      input.stability >= config.minStability ||
      input.reviewCount >= config.minElapsed)
  );
}

function isTopicEligibleForSkip(input: PostponeInput, config: PostponeConfig): boolean {
  return (
    input.priority >= config.topicPriorityMin &&
    (input.reviewCount >= config.topicRepMin ||
      input.daysSinceReview >= config.topicElapsedMin)
  );
}

// =============================================================================
// Interval Randomization
// =============================================================================

function randomizeInterval(base: number, maxNoise: number): number {
  const eps = 0.00001;

  let noise = maxNoise;
  if (noise < eps) noise = 4.0;
  if (base + eps < noise) noise = base + eps;
  if (noise < 0) noise = 0;
  if (noise > 100) noise = 100;

  const random01 = Math.random() / 2.0;
  let n = Math.round(Math.sqrt(1.0 - random01 * 1.97979)) * (-10.8578);

  if (Math.random() > 0.5) {
    n = -n; // flip sign
  }

  const finalNoise = n / 50.0;
  let result = base + finalNoise * noise;
  if (result < 1.0) result = 1.0;
  return result;
}

// =============================================================================
// Core Postpone
// =============================================================================

/**
 * Compute the interval increase for a single element using the SM-20 postpone algorithm.
 * Returns a PostponeResult with the computed increase, new interval, and ratio.
 */
export function postponeElement(input: PostponeInput, config: PostponeConfig): PostponeResult {
  const { type, interval, priority } = input;

  let minInterval = Math.max(1, input.daysSinceReview);
  const defaultRatio = 1.01;

  // Simple mode: skip eligibility, use linear interpolation
  if (config.simpleMode) {
    return simplePostpone(input, config);
  }

  // Topic skip path
  if (type === "topic" && config.skipTopics) {
    const topicMinSkip = config.topicMinSkip ?? 1;
    minInterval = Math.max(1, Math.max(minInterval, topicMinSkip));
    return {
      id: input.id,
      postponed: false,
      increase: 0,
      newInterval: interval,
      ratio: defaultRatio,
    };
  }

  let isSkipped = false;
  let ratio: number;

  if (type === "item") {
    // Check eligibility: if eligible for skip, skip it
    if (config.checkItemSkip && isItemEligibleForSkip(input, config)) {
      isSkipped = true;
    }
    ratio = config.itemIncrease / 100.0 + 1.0;
  } else {
    // Topic
    if (config.checkTopicSkip && isTopicEligibleForSkip(input, config)) {
      isSkipped = true;
    }
    ratio = config.topicIncrease / 100.0 + 1.0;
  }

  if (isSkipped) {
    return {
      id: input.id,
      postponed: false,
      increase: 0,
      newInterval: interval,
      ratio: defaultRatio,
    };
  }

  // Compute raw increase
  const rawIncrease = Math.round(minInterval * ratio) - minInterval;

  // Priority-weighted adjustment
  const scaledPriority = Math.floor(priority / 100.0);
  let adjustedIncrease = rawIncrease * 2 * scaledPriority;

  // Clamp minimum to 1
  if (adjustedIncrease < 1) adjustedIncrease = 1;

  // Apply min/max limits
  if (type === "item") {
    if (adjustedIncrease > config.itemMaxIncrease) adjustedIncrease = config.itemMaxIncrease;
    if (adjustedIncrease < config.itemMinIncrease) adjustedIncrease = config.itemMinIncrease;
  } else {
    if (adjustedIncrease > config.topicMaxIncrease) adjustedIncrease = config.topicMaxIncrease;
    if (adjustedIncrease < config.topicMinIncrease) adjustedIncrease = config.topicMinIncrease;
  }

  // Apply randomization
  if (config.randomize) {
    adjustedIncrease = Math.round(randomizeInterval(adjustedIncrease, adjustedIncrease * 0.5));
    if (adjustedIncrease < 1) adjustedIncrease = 1;
  }

  // Apply cap/floor
  if (type === "item") {
    if (adjustedIncrease > config.itemCap) adjustedIncrease = config.itemCap;
    if (adjustedIncrease < config.itemFloor) adjustedIncrease = config.itemFloor;
  } else {
    if (adjustedIncrease > config.topicCap) adjustedIncrease = config.topicCap;
    if (adjustedIncrease < config.topicFloor) adjustedIncrease = config.topicFloor;
  }

  const newRatio = minInterval > 0 ? (minInterval + adjustedIncrease) / minInterval : defaultRatio;

  return {
    id: input.id,
    postponed: true,
    increase: adjustedIncrease,
    newInterval: interval + adjustedIncrease,
    ratio: newRatio,
  };
}

// =============================================================================
// Batch Postpone
// =============================================================================

/**
 * Postpone all items in a list, collecting statistics.
 * Returns individual results and aggregate stats.
 */
export function postponeAll(
  items: PostponeInput[],
  config: PostponeConfig
): { results: PostponeResult[]; stats: PostponeStats } {
  const results = items.map((item) => postponeElement(item, config));

  const postponed = results.filter((r) => r.postponed);
  const skipped = results.filter((r) => !r.postponed);
  const totalIncrease = postponed.reduce((sum, r) => sum + r.increase, 0);

  return {
    results,
    stats: {
      totalItems: items.length,
      postponedCount: postponed.length,
      skippedCount: skipped.length,
      totalIncrease,
      averageIncrease: postponed.length > 0
        ? Math.round(totalIncrease / postponed.length)
        : 0,
    },
  };
}
