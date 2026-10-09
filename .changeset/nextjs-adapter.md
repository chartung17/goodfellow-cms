---
"@goodfellow-cms/next": minor
"@goodfellow-cms/react": minor
"@goodfellow-cms/blocks": minor
"@goodfellow-cms/core": minor
"goodfellow": minor
"create-goodfellow": minor
---

Add `@goodfellow-cms/next`, which puts a Goodfellow site in a Next.js app, exported as static files. Pages render as Server Components; blocks' links to the site's pages use `next/link` and images `next/image`, sites can be served from a subfolder (`basePath` or `GOODFELLOW_BASE`), and blocks can render Client Components with any hooks. In `next dev` the admin panel saves to the files on disk. `create-goodfellow` can start from a Next.js version of the starter (`--template next`).

`@goodfellow-cms/react` gains a Server Components version (picked through the `react-server` condition), `preparePage()`, and `SiteLink` and `SiteImage`, which blocks use for links and images so they follow the site's base path and the renderer's components. The built-in blocks use them. `@goodfellow-cms/core` gains `withBase()`, `applyBasePath()` and `imageSize()`, and `@goodfellow-cms/core/node` reading sites from disk, image sizes, the local file store and the development API.
