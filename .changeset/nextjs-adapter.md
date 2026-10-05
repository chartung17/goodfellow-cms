---
"@goodfellow/next": minor
"@goodfellow/react": minor
"@goodfellow/core": minor
"goodfellow": minor
"create-goodfellow": minor
---

Add `@goodfellow/next`, which puts a Goodfellow site in a Next.js app: pages render as Server Components with the same HTML as `goodfellow build`, `next build` exports static files, and the admin panel saves to the files on disk in `next dev`. `create-goodfellow` can start from a Next.js version of the starter (`--template next`).

`@goodfellow/react` gains a Server Components version (picked through the `react-server` condition) and `preparePage()`, shared by both renderers. `@goodfellow/core/node` now holds reading a site from disk, the local file store and the development API, which `goodfellow` used to keep to itself.
