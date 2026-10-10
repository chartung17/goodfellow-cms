---
version: 1
title: Introduction
description: What Goodfellow is, how a Goodfellow site works, and where to start.
section: start
order: 1
---

Goodfellow is a website builder for people who aren't developers. Editors build pages from blocks in a visual editor, built on [Puck](https://puckeditor.com), at `/admin` on their own site. There's no server, database or monthly hosting bill: every page is a file in the site's own GitHub or GitLab repository, and a free static host puts the site online.

> Goodfellow is in early development. Everything these pages describe works today, and the [roadmap](https://github.com/chartung17/goodfellow-cms#roadmap) shows what's next. If something doesn't work, or you'd like it to do something it doesn't, [open an issue](https://github.com/chartung17/goodfellow-cms/issues/new/choose).

## How it works

1. An editor opens `/admin` on the site and signs in with their GitHub or GitLab account.
2. They change a page in the editor, which shows it exactly as visitors will see it.
3. **Publish** saves the change to the site's repository, straight from their browser.
4. The host (GitHub Pages, GitLab Pages or Vercel) notices the change and rebuilds the site, usually within a minute or two. The admin panel shows when it's live.

Because the admin panel talks to GitHub or GitLab directly, nothing else needs to run anywhere: no server to keep updated, and nothing for attackers to break into besides your git host account.

## What you can do

- **Pages** made of blocks: sections, columns, headings, text, buttons, images, code, search and more.
- **A header and footer** built the same way, with menus kept separately so links survive a redesign.
- **Collections** of similar pages, such as news, events or these docs, which share one design. Their items can be stored as Markdown.
- **Site settings** for the name, logo, colors, fonts, contact details and custom CSS.
- **A media library** for images and files.
- **An AI assistant** that writes into the page, with each editor's own AI service or a free one.
- **More blocks** from block registries, such as an FAQ or a pricing table, added without a developer.

## Where to start

- To see if Goodfellow fits, read [Why Goodfellow](/docs/why-goodfellow).
- To make a site, follow [Create a site](/docs/create-a-site), then [Put it online](/docs/put-it-online).
- To edit a site someone has set up for you, start with [Edit pages](/docs/edit-pages).
- To write your own blocks or use Goodfellow in a Next.js app, see [Configuration](/docs/configuration).
