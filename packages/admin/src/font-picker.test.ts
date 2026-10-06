import { describe, expect, it } from "vitest";
import { type Font, searchFonts } from "./font-picker.js";
import { GOOGLE_FONTS } from "./google-fonts.js";

const fonts: Font[] = [
  ["Open Sans", "sans-serif"],
  ["Playfair Display", "serif"],
  ["Inter", "sans-serif"],
  ["Noto Sans Display", "sans-serif"],
  ["Display", "display"],
];

describe("searchFonts", () => {
  it("lists fonts in order when there's no search", () => {
    expect(searchFonts(fonts, " ", 2).map(([family]) => family)).toEqual(["Open Sans", "Playfair Display"]);
  });

  it("finds fonts by any part of their name, those starting with it first", () => {
    expect(searchFonts(fonts, "display").map(([family]) => family)).toEqual([
      "Display",
      "Playfair Display",
      "Noto Sans Display",
    ]);
    expect(searchFonts(fonts, "INTER")).toEqual([["Inter", "sans-serif"]]);
    expect(searchFonts(fonts, "xyz")).toEqual([]);
  });
});

describe("GOOGLE_FONTS", () => {
  it("has each family once, including well-known ones", () => {
    const families = GOOGLE_FONTS.map(([family]) => family);
    expect(new Set(families).size).toBe(families.length);
    expect(families).toEqual(expect.arrayContaining(["Inter", "Playfair Display", "Cinzel", "Roboto"]));
  });
});
