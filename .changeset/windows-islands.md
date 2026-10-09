---
"goodfellow": patch
---

Fix `goodfellow build` and `goodfellow dev` on Windows, where pages with Client Components failed with "Invalid array length". The islands plugin compared Vite's module ids, which use forward slashes, with folders written with backslashes, so it turned `@goodfellow-cms/react`'s own Client Components and installed packages' into islands.
