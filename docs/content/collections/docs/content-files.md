---
version: 1
title: Content files
description: The files in content/ that the admin panel edits, including collections and Markdown items.
section: developers
order: 4
---

Everything the admin panel edits is a file in `content/` or `public/media/`, in the site's repository. The format is part of Goodfellow's public interface: it's versioned, and changes come with migrations.

| File | What it holds |
|---|---|
| `content/site.json` | Site settings: name, address, logo, icons, contact details, theme |
| `content/menus.json` | Navigation menus, by name |
| `content/layout/header.json`, `footer.json` | The header and footer, as Puck data |
| `content/pages/about.json` | The page at `/about`, as Puck data; `index.json` is a folder's own page |
| `content/collections/<id>/_collection.json` | A collection's settings, fields and page design |
| `content/collections/<id>/<slug>.json` or `.md` | One item: its field values |
| `content/styles/custom.css` | The custom CSS from Site settings |
| `public/media/` | Uploaded images and files, served at `/media/` |

Every JSON file has a `version`, and is written with two-space indentation, keys in a fixed order and a trailing newline, so changes read well in a diff. If you edit one by hand, run the build, which reports any file that doesn't fit, with what's wrong.

## Collections

A collection's `_collection.json` has its `name`, `entryName` (what one item is called), its `fields`, an optional `path` such as `/events/{slug}` for items' pages, an optional `sort`, and its `template`, the page design. Every collection has a text field named `title`. A field's `name` is what content refers to, so it never changes once items use it.

An item's JSON file holds `{ "version": 1, "fields": { … } }`.

## Markdown items

A collection whose settings have `"markdown": { "body": "body" }` stores each item as `<slug>.md`: the body field is the Markdown text, and every other field is in the front matter, in YAML, beside the version.

```md
---
version: 1
title: Writing blocks
section: developers
order: 2
---

A block is a Puck component…
```

The Markdown is GitHub-flavored (tables, strikethrough, task lists). HTML in it is shown as text rather than run, and links and images can only use addresses that can't run code. Headings get ids for linking, as GitHub gives them: "Writing blocks" becomes `#writing-blocks`. Code blocks are highlighted when the site is built.
