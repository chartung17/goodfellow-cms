---
"@goodfellow/admin": minor
"@goodfellow/core": minor
"goodfellow": minor
---

The admin panel, running against local files. `goodfellow dev` now serves it at `/admin`: edit pages, the header and footer in Puck, and site settings (general, colors and fonts, menus and custom CSS) with a live preview. Classes typed in the editor are styled immediately by Tailwind running in the browser. Saves are single writes that refuse to overwrite changes made since the editor loaded. `@goodfellow/core` adds the `ContentStore` interface, `ConflictError`, `isEditablePath` and reserved page addresses (`/admin`).
