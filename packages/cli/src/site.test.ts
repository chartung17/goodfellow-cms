import { describe, expect, it } from "vitest";
import { baseViteConfig } from "./site.js";

describe("baseViteConfig", () => {
  it("points `@/` at the site's folder with forward slashes, which Vite needs on Windows", () => {
    const config = baseViteConfig("C:\\Users\\me\\site", "C:\\Users\\me\\site\\goodfellow.config.tsx", new Map());
    expect(config.resolve?.alias).toEqual([{ find: /^@\//, replacement: "C:/Users/me/site/" }]);
  });
});
