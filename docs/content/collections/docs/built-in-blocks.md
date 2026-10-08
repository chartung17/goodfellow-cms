---
version: 1
title: Built-in blocks
description: The blocks every Goodfellow site has, from sections and columns to code, search and collection navigation.
section: editors
order: 7
---

Every site has these blocks. Sites can also have [blocks from block registries](/docs/add-blocks) and blocks of their own.

| Block | What it's for |
|---|---|
| Section | A full-width band of the page with a background, centering its content |
| Columns | Equal-width columns that stack on phones |
| Row | Blocks side by side, such as a group of buttons |
| Space | Empty vertical space |
| Heading | A heading, from page title (H1) down to H4 |
| Text | Formatted text: paragraphs, lists, links |
| Button | A link styled as a button |
| Image | An image with an optional caption |
| Code | Code with syntax highlighting, an optional title and a copy button |
| Contact details | The address, phone number and email address from Site settings |
| Menu | One of the site's menus, with dropdowns for submenus |
| Site name and logo | The site's logo and name, linking home |
| Search | A search box for the whole site, with results as you type |
| Collection navigation | Links to every item in a collection, grouped by one of its choice fields |
| Collection list | A collection's items as a list or cards |
| Entry field | One of the item's fields, in a collection's page design only |
| Previous and next | Links to the items before and after this one, in a page design only |
| On this page | The headings of the item's Markdown text, in a page design only |

Blocks use the site's colors, fonts and corner rounding. Every block accepts extra CSS classes, which override the block's own styles: `py-4` on a Section replaces its default padding.

## Code

The Code block highlights code when the site is built, so visitors' browsers don't have to. It knows Bash, CSS, diffs, HTML, JavaScript, JSON, JSX, Markdown, Python, TSX, TypeScript and YAML, in light or dark colors. The copy button's label is the block's to set, so sites in other languages can translate it; leave it empty for no button.

## Search

The Search block searches the whole site in the visitor's browser, with [Pagefind](https://pagefind.app), so no search service is needed. When a site has a Search block, its build makes a search index of every page's main content; headers, footers and "Page not found" are left out. Search only works on the built site, so in the editor the box says so. See [Search](/docs/search) for details.
