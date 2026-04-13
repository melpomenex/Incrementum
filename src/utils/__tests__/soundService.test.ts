import { afterEach, describe, expect, it } from "vitest";
import { resolveSoundUrl } from "../soundService";

describe("soundService", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("resolves public sound assets against document base URI", () => {
    const base = document.createElement("base");
    base.href = "https://example.com/app/";
    document.head.appendChild(base);

    expect(resolveSoundUrl("/sounds/click.mp3")).toBe("https://example.com/app/sounds/click.mp3");
  });

  it("leaves absolute data URLs unchanged", () => {
    expect(resolveSoundUrl("data:audio/mp3;base64,AAAA")).toBe("data:audio/mp3;base64,AAAA");
  });
});
