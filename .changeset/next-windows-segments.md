---
"@goodfellow-cms/next": minor
---

`goodfellow-next finish out`, which the Next.js starter's build script now runs after `next build`, writes the search index as `goodfellow-next index` does, and on Windows moves Next.js's prefetch files to where browsers ask for them. Next.js 16 writes them into `__next.…` folders there, so every prefetch while moving between pages was "not found". `fixSegmentFiles()` is exported from `@goodfellow-cms/next/export`.
