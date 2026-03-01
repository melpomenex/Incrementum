import { beforeEach, describe, expect, it } from "vitest";
import { buildPublicProfileData, setPublicProfileConfig } from "../wave4Social";

describe("wave4Social privacy", () => {
  beforeEach(() => {
    const memoryStore = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => memoryStore.get(key) ?? null,
        setItem: (key: string, value: string) => memoryStore.set(key, value),
        removeItem: (key: string) => memoryStore.delete(key),
      },
      configurable: true,
    });
  });

  it("shares only selected fields when profile is enabled", () => {
    const config = setPublicProfileConfig({
      enabled: true,
      slug: "alice",
      fields: ["streak", "retentionRate"],
    });

    const profile = buildPublicProfileData(config, {
      streak: 10,
      cardsLearned: 400,
      retentionRate: 0.91,
      reviewsToday: 22,
    });

    expect(profile).toMatchObject({ enabled: true, slug: "alice", streak: 10, retentionRate: 0.91 });
    expect(profile.cardsLearned).toBeUndefined();
    expect(profile.reviewsToday).toBeUndefined();
  });

  it("returns disabled payload when sharing is off", () => {
    const profile = buildPublicProfileData(
      { enabled: false, slug: "", fields: [] },
      { streak: 5, cardsLearned: 20, retentionRate: 0.5, reviewsToday: 1 }
    );
    expect(profile).toEqual({ enabled: false });
  });
});
