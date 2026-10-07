#!/usr/bin/env node
// After `next build`: `goodfellow-next index out` writes the search index for sites with a search block.
import { writeSearchIndex } from "@goodfellow/core/search-index";

const [command, dir = "out"] = process.argv.slice(2);
if (command !== "index") {
  console.error(
    "Usage: goodfellow-next index [folder]\n\nIndexes the exported site in folder (default: out) for its search block.",
  );
  process.exit(1);
}
const indexed = await writeSearchIndex(dir);
console.log(
  indexed === undefined
    ? `No page in ${dir} has a search block, so there's nothing to index`
    : `Indexed ${indexed} pages for search`,
);
