import { describe, it, expect } from "vitest";
import { stripTrackingParams } from "../cleanUrl";

describe("stripTrackingParams", () => {
  it("strips common tracking parameters", () => {
    expect(
      stripTrackingParams("https://example.com/article?utm_source=twitter&utm_medium=social&id=42")
    ).toBe("https://example.com/article?id=42");
  });

  it("strips facebook, google, and mailchimp click IDs", () => {
    expect(
      stripTrackingParams("https://example.com/a?fbclid=abc&gclid=def&mc_cid=ghi&mc_eid=jkl&keep=1")
    ).toBe("https://example.com/a?keep=1");
  });

  it("strips YouTube share params and other platform trackers", () => {
    expect(
      stripTrackingParams("https://youtu.be/dQw4w9WgXcQ?si=SHARECODE&feature=share&t=42")
    ).toBe("https://youtu.be/dQw4w9WgXcQ?t=42");
  });

  it("preserves legitimate query parameters", () => {
    expect(stripTrackingParams("https://example.com/search?q=cats&page=2&sort=date")).toBe(
      "https://example.com/search?q=cats&page=2&sort=date"
    );
  });

  it("returns the URL unchanged when it has no query string", () => {
    expect(stripTrackingParams("https://example.com/article")).toBe("https://example.com/article");
  });

  it("returns the URL unchanged when query has only legitimate params", () => {
    expect(stripTrackingParams("https://example.com/a?id=1")).toBe("https://example.com/a?id=1");
  });

  it("drops the trailing '?' when all params are stripped", () => {
    expect(stripTrackingParams("https://example.com/a?utm_source=x")).toBe("https://example.com/a");
  });

  it("preserves hash fragments", () => {
    expect(stripTrackingParams("https://example.com/a?utm_source=x#section")).toBe(
      "https://example.com/a#section"
    );
  });

  it("preserves hash fragments with surviving params", () => {
    expect(stripTrackingParams("https://example.com/a?id=1&utm_source=x#top")).toBe(
      "https://example.com/a?id=1#top"
    );
  });

  it("returns non-parseable input unchanged (relative / malformed)", () => {
    expect(stripTrackingParams("/articles/123")).toBe("/articles/123");
    expect(stripTrackingParams("not a url")).toBe("not a url");
    expect(stripTrackingParams("")).toBe("");
  });

  it("strips utm_* prefix match (campaign, content, term)", () => {
    expect(
      stripTrackingParams("https://example.com/a?utm_campaign=spring&utm_content=hero&valid=1")
    ).toBe("https://example.com/a?valid=1");
  });

  it("handles HubSpot, Yandex, Microsoft, Twitter trackers", () => {
    expect(
      stripTrackingParams(
        "https://example.com/a?_hsenc=1&_hsmi=2&yclid=3&msclkid=4&twclid=5&keep=1"
      )
    ).toBe("https://example.com/a?keep=1");
  });
});
