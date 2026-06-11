// TAS (Tag-Aware Scheduling) API wrappers

import { invoke } from "@tauri-apps/api/core";
import type { TASConfig, TASScheduledItem, TagStabilityStats } from "../types/tas";

/** Build the TAS-annotated queue for a given date */
export async function buildTasQueue(date: string): Promise<TASScheduledItem[]> {
  return invoke("build_tas_queue", { date });
}

/** Set prerequisites for a tag */
export async function setTagPrerequisites(
  tagId: string,
  prerequisiteIds: string[]
): Promise<void> {
  return invoke("set_tag_prerequisites", { tagId, prerequisiteIds });
}

/** Get maturity statistics for a tag */
export async function getTagMaturityStats(
  tagId: string
): Promise<TagStabilityStats> {
  return invoke("get_tag_maturity_stats", { tagId });
}

/** Get all tags */
export async function getTags(): Promise<import("../types/tas").Tag[]> {
  return invoke("get_tags");
}

/** Create or update a tag with TAS metadata */
export async function upsertTag(tag: {
  name: string;
  prerequisites?: string[];
  maturityThreshold?: number;
}): Promise<import("../types/tas").Tag> {
  return invoke("upsert_tag", { tag });
}

/** Delete a tag and cleanup its references */
export async function deleteTag(tagId: string): Promise<void> {
  return invoke("delete_tag", { tagId });
}

/** Sync tags: scan all items and insert missing tag names */
export async function syncTags(): Promise<number> {
  return invoke("sync_tags");
}

/** Compute tag centroids and coherence from existing embeddings */
export async function computeTagCentroids(): Promise<number> {
  return invoke("compute_tag_centroids");
}

/** Get the current TAS configuration */
export async function getTasConfig(): Promise<TASConfig> {
  return invoke("get_tas_config");
}

/** Update the TAS configuration */
export async function updateTasConfig(config: TASConfig): Promise<void> {
  return invoke("update_tas_config", { config });
}
