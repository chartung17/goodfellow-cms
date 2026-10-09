---
"@goodfellow-cms/core": minor
"@goodfellow-cms/admin": minor
"@goodfellow-cms/blocks": minor
"@goodfellow-cms/react": patch
"goodfellow": minor
"@goodfellow-cms/next": minor
---

Markdown collections, code highlighting, search and blocks for documentation sites.

- **Markdown collections:** a collection can store its items as Markdown files (`markdown: { body }` in its settings), with the other fields as YAML front matter. The admin panel's collection settings turn it on and convert every item; the body is edited in the formatted editor or a Markdown tab, and Markdown the formatted editor can't show, such as a table, is edited as Markdown only. `@goodfellow-cms/core` adds `parseMarkdownEntry()`, `serializeMarkdownEntry()`, `markdownToHtml()`, `markdownParts()`, `markdownHeadings()` and `canFormatMarkdown()`; HTML in Markdown is shown as text, and only safe addresses are kept.
- **Code block:** code highlighted with Shiki when the site is built, with a title and a copy button. Code in Markdown text is highlighted too.
- **Search block:** searches the site in the visitor's browser with Pagefind. Builds index a site only when a page has a search block (`data-goodfellow-search`); `goodfellow build` does it, `goodfellow index` indexes any built site, and Next.js sites run `goodfellow-next index out` after `next build`. Pages mark their main content for indexing.
- **Collection navigation**, **Previous and next** and **On this page** blocks, for documentation and other sites with ordered collections.
- Formatted text styles tables, images and code.
