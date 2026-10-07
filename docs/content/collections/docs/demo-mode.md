---
version: 1
title: Demo mode
description: Let anyone try the admin panel without signing in, with their changes kept in their own browser.
section: owners
order: 3
---

To let anyone try the admin panel without signing in, for example from a product page or in a training session, set `demo: true` in `goodfellow.config.tsx`:

```tsx
export default defineConfig({ blocks, demo: true });
```

The site's `/admin` then opens straight away, with a banner saying it's a demo. Visitors can try everything editors can: pages, collections, the header and footer, the media library, site settings and the AI assistant (with their own key or a free service).

- **Nothing is published.** Publish saves the changes, uploads included, in the visitor's own browser, so they're still there after reloading. **Start over** in the banner undoes them all. The live site and the repository never change.
- **It starts from the site as last built.** The build puts a copy of the content at `/admin/demo-content.json`. The repository can stay private, and `backend` is ignored.
- **Blocks** can be browsed but not added or removed, since adding one changes the site's code.
- **Only the config turns it on.** The admin panel never changes `goodfellow.config.tsx`, so editors can't turn a real site into a demo or back.
- **In development**, the demo starts from the files on disk, and changes stay in the browser there too. To edit a demo site's own content in the admin panel, turn demo mode off while you do.
