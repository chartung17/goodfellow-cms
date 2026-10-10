---
"@goodfellow-cms/react": patch
---

Next.js sites send visitors much less JavaScript: the starter's pages load 186 kB (gzipped) instead of 513 kB. `@goodfellow-cms/react` is now built one file per module, so Client Components that import `SiteLink`, `SiteImage` or `useSite` from it, such as the Search block's box and the image carousel, no longer bring Puck and the page renderer with them.
