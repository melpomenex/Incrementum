import { describe, expect, it } from "vitest";
import { buildYouTubeNoCookieEmbedUrl, extractYouTubeVideoId } from "./youtubeEmbed";

describe("extractYouTubeVideoId", () => {
  it("extracts from watch URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=n04A6phTTVc")).toBe("n04A6phTTVc");
  });

  it("extracts from youtu.be URL", () => {
    expect(extractYouTubeVideoId("https://youtu.be/n04A6phTTVc?t=12")).toBe("n04A6phTTVc");
  });

  it("extracts from shorts URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/shorts/n04A6phTTVc?feature=share")).toBe("n04A6phTTVc");
  });

  it("returns null for non-youtube URLs", () => {
    expect(extractYouTubeVideoId("https://example.com/watch?v=n04A6phTTVc")).toBeNull();
  });
});

describe("buildYouTubeNoCookieEmbedUrl", () => {
  it("builds nocookie embed URL with required params", () => {
    const url = buildYouTubeNoCookieEmbedUrl("n04A6phTTVc", 42);
    expect(url).toContain("https://www.youtube-nocookie.com/embed/n04A6phTTVc?");
    expect(url).toContain("enablejsapi=1");
    expect(url).toContain("modestbranding=1");
    expect(url).toContain("rel=0");
    expect(url).toContain("playsinline=1");
    expect(url).toContain("start=42");
  });
});

