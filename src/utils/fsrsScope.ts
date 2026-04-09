import type { Settings } from "../stores/settingsStore";
import { normalizeFsrsParameters } from "./fsrsParameters";

export type FsrsScopeType = "deck" | "tag";

export interface FsrsScopeOverride {
  id: string;
  scopeType: FsrsScopeType;
  scopeId: string;
  desiredRetention?: number;
  maximumInterval?: number;
  personalizedWeights?: number[];
  enabled: boolean;
}

export interface ResolvedFsrsParams {
  desiredRetention: number;
  maximumInterval: number;
  personalizedWeights?: number[];
  source: "global" | "deck" | "tag";
}

interface ResolveOptions {
  settings: Settings;
  activeDeckId?: string | null;
  tags?: string[];
}

export function resolveFsrsParamsForScope(options: ResolveOptions): ResolvedFsrsParams {
  const { settings, activeDeckId, tags = [] } = options;
  const globalParams = settings.learning.fsrsParams;
  const overrides = settings.learning.scopedFsrsOverrides ?? [];

  const enabledOverrides = overrides.filter((entry) => entry.enabled);
  const normalizedTags = new Set(tags.map((tag) => tag.toLowerCase()));

  const deckOverride = activeDeckId
    ? enabledOverrides.find((entry) => entry.scopeType === "deck" && entry.scopeId === activeDeckId)
    : undefined;

  const tagOverride = enabledOverrides.find(
    (entry) => entry.scopeType === "tag" && normalizedTags.has(entry.scopeId.toLowerCase())
  );

  // Precedence: global -> deck -> tag
  const winner = tagOverride ?? deckOverride;
  if (!winner) {
    return {
      desiredRetention: globalParams.desiredRetention,
      maximumInterval: globalParams.maximumInterval,
      personalizedWeights: normalizeFsrsParameters(globalParams.personalizedWeights),
      source: "global",
    };
  }

  return {
    desiredRetention: winner.desiredRetention ?? globalParams.desiredRetention,
    maximumInterval: winner.maximumInterval ?? globalParams.maximumInterval,
    personalizedWeights: normalizeFsrsParameters(
      winner.personalizedWeights ?? globalParams.personalizedWeights
    ),
    source: winner.scopeType,
  };
}
