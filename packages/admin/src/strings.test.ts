import { describe, expect, it } from "vitest";
import { defaultStrings } from "./strings.js";

describe("defaultStrings", () => {
  it("never uses git jargon", () => {
    for (const [key, text] of Object.entries(defaultStrings)) {
      expect(text, key).not.toMatch(/\b(commit|push|pull request|merge request|branch|repository|repo)\b/i);
    }
  });
});
