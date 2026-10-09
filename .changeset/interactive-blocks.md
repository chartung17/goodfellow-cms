---
"goodfellow": minor
"@goodfellow-cms/react": minor
"@goodfellow-cms/core": patch
---

Client Components in blocks (`"use client"`) now run in the browser on sites built with `goodfellow build` and served by `goodfellow dev`, not only with Next.js. Each one a block uses becomes an island: its HTML is in the page as before, and the page loads React and that component's code to bring it to life, with `useSite()`, `useId()` and content passed as `children` working as they do in Next.js. Pages without Client Components still load no JavaScript. Client Components in packages of blocks are found too.

`goodfellow build` now always bundles for production, so the admin panel no longer ships React's development build. `@goodfellow-cms/core` is published one file per module, so browser bundles that only need a helper such as `withBase()` leave out the content schemas.
