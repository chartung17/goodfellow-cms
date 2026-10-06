// Updates src/google-fonts.ts, the fonts Site settings offers, from Google Fonts' list of families.
// Run with `pnpm --filter @goodfellow/admin update-fonts`, and commit the result.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CATEGORIES = {
  "Sans Serif": "sans-serif",
  Serif: "serif",
  Display: "display",
  Handwriting: "handwriting",
  Monospace: "monospace",
};

const response = await fetch("https://fonts.google.com/metadata/fonts");
if (!response.ok) throw new Error(`Google Fonts answered ${response.status}.`);
const { familyMetadataList } = await response.json();

const fonts = familyMetadataList
  .filter((font) => CATEGORIES[font.category])
  // Most used first, so the list starts with fonts people are likely to want.
  .sort((a, b) => a.popularity - b.popularity || a.family.localeCompare(b.family))
  .map((font) => `  [${JSON.stringify(font.family)}, ${JSON.stringify(CATEGORIES[font.category])}],`);

const file = fileURLToPath(new URL("../src/google-fonts.ts", import.meta.url));
await writeFile(
  file,
  [
    "// Made by scripts/google-fonts.mjs from Google Fonts' list of families. Don't edit it by hand.",
    'import type { FontCategory } from "./font-picker.js";',
    "",
    "/** Every Google Fonts family, most used first, with its category. */",
    "export const GOOGLE_FONTS: ReadonlyArray<readonly [family: string, category: FontCategory]> = [",
    ...fonts,
    "];",
    "",
  ].join("\n"),
);
console.log(`Wrote ${fonts.length} fonts to ${file}.`);
