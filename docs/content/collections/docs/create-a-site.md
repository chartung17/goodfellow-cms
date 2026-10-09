---
version: 1
title: Create a site
description: Make a new Goodfellow site from a starter, and try it on your own computer.
section: start
order: 3
---

You need [Node.js](https://nodejs.org) 22 or later.

## With create-goodfellow

```sh
npm create goodfellow@latest my-site
```

It asks:

- **Which site to start from:** the **Starter** (a home page, an about page and a news section), the **Parish example** (a complete made-up parish site, with collections and blocks of its own) or the **Starter for Next.js** (see [Next.js](/docs/nextjs)).
- **Where the site will be stored:** GitHub or GitLab, and the repository's name.
- **Where it will be hosted:** GitHub Pages, GitLab Pages or Vercel, with each host's rules for business sites. Only that host's setup file is kept.
- **Which blocks to start with:** the recommended blocks from Goodfellow's [block registry](/docs/add-blocks), such as an FAQ and tabs, or the built-in blocks only. Either way, blocks can be added and removed later in the admin panel.

To skip the questions, give the answers as options:

```sh
npm create goodfellow@latest my-site -- --template parish --github your-name/your-site --host github-pages --blocks built-in
```

Run it with `--help` for every option.

> To try changes that haven't been released yet, use the sites in [the repository](https://github.com/chartung17/goodfellow-cms) instead: install [pnpm](https://pnpm.io), run `pnpm install` and `pnpm build` at the root, then `pnpm dev` in `templates/starter`.

## Try it on your computer

In the new site's folder:

```sh
npm install
npm run dev
```

The site is at <http://localhost:4321>, and the admin panel at <http://localhost:4321/admin>. On your own computer the admin panel saves straight to the files in `content/`, with no sign-in, and pages show your changes when you reload them.

```sh
npm run build    # writes the finished site to dist/
npm run preview  # serves dist/ the way a host would
```

## What's in a site

```text
my-site/
├── goodfellow.config.tsx    # the site's blocks and where it's stored
├── blocks/                  # the site's own blocks, and blocks/installed/ from block registries
├── components/ui/           # shadcn components that installed blocks use
├── content/                 # everything the admin panel edits
│   ├── site.json            # name, logo, colors, fonts, contact details
│   ├── menus.json           # navigation menus
│   ├── layout/header.json   # the header and footer
│   ├── pages/index.json     # one file per page, named after its address
│   ├── collections/news/    # a collection: its settings and one file per item
│   └── styles/custom.css    # custom CSS from Site settings
├── public/media/            # uploaded images and files
├── src/styles.css           # Tailwind and the site's theme
└── .github/workflows/deploy.yml, .gitlab-ci.yml, vercel.json   # host setups
```

Next, [put it online](/docs/put-it-online).
