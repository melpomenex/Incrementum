import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../stores/settingsStore";
import { resolveFsrsParamsForScope } from "../fsrsScope";

describe("resolveFsrsParamsForScope", () => {
  it("falls back to global parameters when no override matches", () => {
    const resolved = resolveFsrsParamsForScope({
      settings: defaultSettings,
      activeDeckId: "deck-a",
      tags: ["biology"],
    });

    expect(resolved.source).toBe("global");
    expect(resolved.desiredRetention).toBe(defaultSettings.learning.fsrsParams.desiredRetention);
    expect(resolved.maximumInterval).toBe(defaultSettings.learning.fsrsParams.maximumInterval);
  });

  it("uses deck override when deck matches", () => {
    const settings = {
      ...defaultSettings,
      learning: {
        ...defaultSettings.learning,
        scopedFsrsOverrides: [
          {
            id: "deck-1",
            scopeType: "deck" as const,
            scopeId: "deck-a",
            desiredRetention: 0.95,
            maximumInterval: 8000,
            enabled: true,
          },
        ],
      },
    };

    const resolved = resolveFsrsParamsForScope({
      settings,
      activeDeckId: "deck-a",
      tags: [],
    });

    expect(resolved.source).toBe("deck");
    expect(resolved.desiredRetention).toBe(0.95);
    expect(resolved.maximumInterval).toBe(8000);
  });

  it("prefers tag override over deck override", () => {
    const settings = {
      ...defaultSettings,
      learning: {
        ...defaultSettings.learning,
        scopedFsrsOverrides: [
          {
            id: "deck-1",
            scopeType: "deck" as const,
            scopeId: "deck-a",
            desiredRetention: 0.92,
            maximumInterval: 9000,
            enabled: true,
          },
          {
            id: "tag-1",
            scopeType: "tag" as const,
            scopeId: "biology",
            desiredRetention: 0.97,
            maximumInterval: 4000,
            enabled: true,
          },
        ],
      },
    };

    const resolved = resolveFsrsParamsForScope({
      settings,
      activeDeckId: "deck-a",
      tags: ["Biology", "exam"],
    });

    expect(resolved.source).toBe("tag");
    expect(resolved.desiredRetention).toBe(0.97);
    expect(resolved.maximumInterval).toBe(4000);
  });

  it("propagates personalized weight vectors from winning scope", () => {
    const settings = {
      ...defaultSettings,
      learning: {
        ...defaultSettings.learning,
        fsrsParams: {
          ...defaultSettings.learning.fsrsParams,
          personalizedWeights: Array.from({ length: 17 }, (_, i) => i + 1),
        },
        scopedFsrsOverrides: [
          {
            id: "tag-typed",
            scopeType: "tag" as const,
            scopeId: "bio",
            personalizedWeights: Array.from({ length: 17 }, (_, i) => i + 101),
            enabled: true,
          },
        ],
      },
    };
    const resolved = resolveFsrsParamsForScope({
      settings,
      tags: ["bio"],
    });
    expect(resolved.personalizedWeights?.[0]).toBe(101);
    expect(resolved.personalizedWeights).toHaveLength(17);
  });
});
