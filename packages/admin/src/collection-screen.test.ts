import { describe, expect, it } from "vitest";
import { inSentence } from "./collection-screen.js";

describe("inSentence", () => {
  it("lowercases ordinary words but not abbreviations", () => {
    expect(inSentence("Video")).toBe("video");
    expect(inSentence("News story")).toBe("news story");
    expect(inSentence("FAQ")).toBe("FAQ");
    expect(inSentence("X")).toBe("X");
  });
});
