#!/usr/bin/env node
// After `next build`: `goodfellow-next finish out` fixes the export's prefetch files on Windows
// and writes the search index for sites with a search block. `index` only writes the index.
import { writeSearchIndex } from "@goodfellow/core/search-index";
import { fixSegmentFiles } from "@goodfellow/next/export";

const [command, dir = "out"] = process.argv.slice(2);
if (command !== "finish" && command !== "index") {
  console.error(
    [
      "Usage: goodfellow-next finish [folder]",
      "       goodfellow-next index [folder]",
      "",
      "finish  Gets the exported site in folder (default: out) ready to publish: puts the files",
      "        Next.js uses to load pages ahead where browsers look for them, and indexes it for search.",
      "index   Only indexes the exported site for its search block.",
    ].join("\n"),
  );
  process.exit(1);
}
if (command === "finish") {
  const moved = await fixSegmentFiles(dir);
  if (moved > 0) console.log(`Moved ${moved} of Next.js's prefetch files to where browsers look for them`);
}
const indexed = await writeSearchIndex(dir);
console.log(
  indexed === undefined
    ? `No page in ${dir} has a search block, so there's nothing to index`
    : `Indexed ${indexed} pages for search`,
);
