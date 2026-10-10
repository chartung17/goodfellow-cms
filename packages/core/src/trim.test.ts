import { describe, expect, it } from "vitest";
import { trimChars } from "./trim.js";

describe("trimChars", () => {
  it("trims the characters from both ends, or only the one asked", () => {
    expect(trimChars("//repo/name//", "/")).toBe("repo/name");
    expect(trimChars("https://example.org//", "/", { start: false })).toBe("https://example.org");
    expect(trimChars("._my-site--", "._-")).toBe("my-site");
    expect(trimChars("///", "/")).toBe("");
  });
});
