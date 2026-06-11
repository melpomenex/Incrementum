// Tag-Aware Scheduling (TAS) TypeScript types

/** TAS configuration persisted in settings */
export interface TASConfig {
  enabled: boolean;
  interference: TASInterferenceConfig;
  prerequisites: TASPrerequisiteConfig;
}

export interface TASInterferenceConfig {
  enabled: boolean;
  minSeparationHours: number;
  coherenceThreshold: number;
}

export interface TASPrerequisiteConfig {
  enabled: boolean;
  maturityRatio: number;
}

/** A tag entity with TAS metadata */
export interface Tag {
  id: string;
  name: string;
  prerequisites: string[];
  maturityThreshold: number;
  centroid?: number[];
  coherence?: number;
  itemCount: number;
  avgStability?: number;
  matureCount: number;
  dateCreated: string;
  dateModified: string;
}

/** Computed stability statistics for a tag */
export interface TagStabilityStats {
  itemCount: number;
  avgStability?: number;
  matureCount: number;
  maturityRatio: number;
}

/** An item annotated by the TAS scheduler */
export interface TASScheduledItem {
  itemId: string;
  documentId: string;
  documentTitle: string;
  itemType: string;
  tags: string[];
  priority: number;
  dueDate?: string;
  stability?: number;
  prerequisiteBlocked: boolean;
  interferenceDelayUntil?: string;
  blockReason?: string;
}

/** Default TAS configuration */
export const DEFAULT_TAS_CONFIG: TASConfig = {
  enabled: false,
  interference: {
    enabled: true,
    minSeparationHours: 4,
    coherenceThreshold: 0.75,
  },
  prerequisites: {
    enabled: true,
    maturityRatio: 0.7,
  },
};
