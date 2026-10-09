---
"@goodfellow-cms/admin": patch
"@goodfellow-cms/core": patch
---

When the admin panel on your computer can't reach the development server's API, for example because another server answers at that address, its error says so and where it looked, instead of "Cannot read properties of undefined". The admin panel calls the development API with a trailing slash, so a Next.js site's `trailingSlash` setting has nothing to redirect. Browsers keep those permanent redirects and later apply them to whatever runs on the same port, which broke `goodfellow dev`'s admin panel after a Next.js site had run there. The API also accepts its addresses without one.
