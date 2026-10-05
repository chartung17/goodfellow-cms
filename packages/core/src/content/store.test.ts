import { describe, expect, it } from "vitest";
import { isEditablePath } from "./store.js";

describe("isEditablePath", () => {
  it.each(["content/site.json", "content/pages/about/team.json", "content/styles/custom.css", "public/media/logo.png"])(
    "allows %s",
    (path) => {
      expect(isEditablePath(path)).toBe(true);
    },
  );

  it.each([
    "goodfellow.config.tsx",
    "package.json",
    "content",
    "public/index.html",
    "/content/site.json",
    "content/../package.json",
    "content/./site.json",
    "content//site.json",
    "content\\site.json",
    "contents/site.json",
  ])("refuses %s", (path) => {
    expect(isEditablePath(path)).toBe(false);
  });
});
