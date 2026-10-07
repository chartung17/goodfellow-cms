---
version: 1
title: Commands
description: goodfellow dev, build, preview and index, and serving a site from a subfolder.
section: developers
order: 5
---

| Command | What it does |
|---|---|
| `goodfellow dev` | Serves the site, rendering each page from the files on disk, plus the admin panel at `/admin`, which saves to those files |
| `goodfellow build` | Writes one HTML file per page to `dist/`, builds the CSS and copies `public/`. Also writes `sitemap.xml` and `robots.txt` if the site's address is set, the admin panel if the config has a `backend` or `demo`, the JavaScript for [Client Components](/docs/interactive-blocks), and a [search index](/docs/search) if a page has a Search block |
| `goodfellow preview` | Serves `dist/` the way a host would, including the "Page not found" page |
| `goodfellow index` | Writes the search index for a site built another way |

Options: `--root <dir>`, `--out <dir>`, `--port <port>`, and `--base <path>`.

## Serving from a subfolder

Some hosts serve a site from a subfolder, such as `/my-repo/` on GitHub Pages. The base path comes from `--base`, then the `GOODFELLOW_BASE` environment variable, then `base` in `goodfellow.config.tsx`. Every root-relative link and image in the built pages is adjusted to match, including links inside formatted and Markdown text.

The site's address (Site settings → General) should be the full public address, subfolder included.
