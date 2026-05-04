/**
 * Schedule Spread Utility
 *
 * Uses the postpone engine in-memory to compute a projected distribution
 * of items across a future horizon. Does NOT persist changes — used for
 * preview in the SpreadModal.
 *
 * Supports both learning items and documents.
 */

import {
  postponeAll,
  defaultPostponeConfig,
  type PostponeInput,
  type PostponeResult,
  type PostponeStats,
} from "./postpone";
import type { ScheduleDayItem } from "../types/queue";

export interface SpreadProjection {
  /** Items that were actually postponed */
  postponedItems: PostponeResult[];
  /** Items that were skipped (not eligible by postpone engine) */
  skippedItemIds: string[];
  /** Aggregate stats from the postpone engine */
  stats: PostponeStats;
  /** Projected daily distribution: date -> count of postponed items landing on that day */
  dailyDistribution: Map<string, number>;
}

/**
 * Compute a spread projection for the given items across a horizon.
 *
 * Learning items use the postpone engine (SM-20) for algorithm-aware scheduling.
 * Documents use a simpler even-distribution strategy (topic postpone).
 * Returns the projected distribution without making any API calls.
 */
export function computeSpreadProjection(
  items: ScheduleDayItem[],
  horizonDays: number,
): SpreadProjection {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  const now = new Date();

  // Build PostponeInput for learning items and documents
  const inputs: PostponeInput[] = [];
  const skippedIds: string[] = [];

  for (const item of items) {
    const dueDate = item.dueDate ? new Date(item.dueDate) : now;
    const daysSinceReview = Math.max(
      0,
      Math.floor((now.getTime() - dueDate.getTime()) / 86400000),
    );

    if (item.itemType === "document") {
      // Treat documents as "topics" in the SM-20 model
      inputs.push({
        id: item.id,
        type: "topic",
        interval: item.interval ?? 1,
        priority: item.priority,
        stability: item.stability ?? 1,
        difficulty: item.difficulty ?? 3,
        reviewCount: 0,
        lapses: 0,
        daysSinceReview,
      });
    } else if (item.itemType === "learning-item") {
      inputs.push({
        id: item.id,
        type: "item",
        interval: item.interval ?? 1,
        priority: item.priority,
        stability: item.stability ?? 1,
        difficulty: item.difficulty ?? 3,
        reviewCount: 0,
        lapses: item.lapses ?? 0,
        daysSinceReview,
      });
    } else {
      // Extracts and other types: use simple even spread
      skippedIds.push(item.id);
    }
  }

  // Run postpone engine in-memory
  const { results, stats } = postponeAll(inputs, defaultPostponeConfig);

  // Build daily distribution from results
  const dailyDistribution = new Map<string, number>();

  for (const result of results) {
    if (!result.postponed) {
      skippedIds.push(result.id);
      continue;
    }

    // The postpone engine gives us the new interval. We compute the new date
    // by adding the increase to the item's original due date.
    const item = items.find((i) => i.id === result.id);
    if (!item) continue;

    const originalDue = item.dueDate ? new Date(item.dueDate) : now;
    originalDue.setHours(0, 0, 0, 0);
    const newDue = new Date(originalDue.getTime() + result.increase * 86400000);

    // Clamp to horizon
    const maxDate = new Date(startDate.getTime() + horizonDays * 86400000);
    if (newDue > maxDate) {
      newDue.setTime(maxDate.getTime());
    }

    const dateStr = newDue.toISOString().split("T")[0];
    dailyDistribution.set(dateStr, (dailyDistribution.get(dateStr) ?? 0) + 1);
  }

  return {
    postponedItems: results.filter((r) => r.postponed),
    skippedItemIds: skippedIds,
    stats,
    dailyDistribution,
  };
}

/**
 * Generate a date range string array for the horizon.
 */
export function getDateRange(horizonDays: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}
