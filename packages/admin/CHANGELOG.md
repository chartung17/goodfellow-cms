# @goodfellow-cms/admin

## 0.1.0

### Minor Changes

- 1d4191f: The admin panel has a dark mode. It follows the computer's light or dark setting, or the choice in its top bar's color menu, which the browser remembers. Puck's own colors and the code editor follow it; site previews keep the site's colors.
- 1414af7: The AI assistant. A new **AI** tab in every editor writes with AI: it adds blocks to a page, changes the selected block, or fills in a collection item's fields, and its answer goes straight into the editor to check, change or undo. Editors choose the service and use their own key, kept only in their browser: Claude through the official SDK with structured outputs, OpenAI, Gemini, Groq, Mistral, OpenRouter, the keyless OVHcloud AI Endpoints, any OpenAI-compatible service, or any chat app by copy and paste. The new `@goodfellow-cms/ai` package builds the requests, checks answers against the site's blocks and fields, and talks to the services; `@goodfellow-cms/ai/testing` fakes them. Sites can limit the services with `ai: { providers }` or remove the assistant with `ai: false`.
- fd6f851: Blocks from block registries. The admin panel has a **Blocks** screen that adds blocks built with shadcn/ui to the editor, and removes them, with no developer: adding one publishes its code into the site's `blocks/installed/` and the shadcn components it uses into `components/ui/`, in one commit, and the editor offers it once the site has been rebuilt. Removing a block is refused while content uses it, and keeps files someone has changed.
  
  `@goodfellow-cms/registry` is Goodfellow's registry, with nine blocks: Hero, Cards, Call to action, Testimonials, Notice, Pricing table, FAQ, Tabs and Image carousel. Its README documents the format for registries of blocks built with other libraries, which a site offers once its config lists them in `registries`.
  
  `create-goodfellow` starts new sites with the recommended blocks, or with `--blocks built-in` the built-in blocks only. `@goodfellow-cms/core` plans installs and removals (`planInstall()`, `planRemove()`), and its stores and the GitLab backend read and write the folders installed blocks use. `goodfellow dev` and `next dev` serve the site's copy of the registry, and `goodfellow` resolves `@/` imports from the site's root, as shadcn code expects. `@goodfellow-cms/react`'s theme adds the colors shadcn components use, such as `card` and `destructive`.
- b4b80a6: The Blocks screen marks blocks to add and remove, and publishes them all in one save. `planBlockChanges()` plans several adds and removes together, each as if the ones before it had been published.
- 2e85621: Custom CSS and the site's code are edited in a code editor (CodeMirror, loaded when first shown) that indents, closes brackets, suggests CSS properties and values or HTML tags, and finds and replaces. Undo in Site settings no longer counts a change that leaves every value the same as a step.
- 5492e22: Collections and templates. A collection, such as videos or events, lives in `content/collections/<name>/`: a `_collection.json` with its fields, an address pattern such as `/videos/{slug}` and a Puck template, plus one file per item. `goodfellow build` and `goodfellow dev` give every item a page from its collection's template, where `{field}` placeholders and the new template-only Entry field block show the item's values. The new Collection list block shows a collection's items on any page, as a list or cards, newest first, upcoming only, and so on. The admin panel has a Collections screen for creating collections, editing their fields and page design, and adding, editing, renaming and deleting items. `@goodfellow-cms/core` adds `allPages()`, `findEntry()` and the collection schemas; `@goodfellow-cms/react` adds a `template` Puck config, `templateOnly()` and `applyEntry()`.
- 2af75b7: Site settings has a Code tab for code from services such as Google Analytics: "In the page head" (script, style, link, meta, base and noscript tags, read with `parseHeadCode()`) and "At the end of the page" (any HTML), saved as `content/code/head.html` and `content/code/body.html`. `goodfellow build` and Next.js add it to every page with `HeadCode` and `BodyCode`; it never runs in the admin panel.
- 88ac239: Demo mode. A site whose config sets `demo: true` opens its admin panel to anyone, with no sign-in and a banner saying it's a demo. Visitors can try everything editors can, but nothing is published: Publish saves their changes, uploads included, in their own browser (IndexedDB), where they stay until the visitor clicks Start over. The Blocks screen lists blocks without adding or removing them.
  
  The demo starts from a copy of the site's content that builds include at `/admin/demo-content.json`, so no git host is called and the repository can stay private. `goodfellow build` writes it, along with the admin panel, for demo sites; Next.js sites serve it with `demoContent` from `goodfellowPages()`, in a new `app/admin/demo-content.json/route.ts`. `@goodfellow-cms/core` adds `demoContent()`, `demoStore()` and the config's `demo` option.
- 652b180: Markdown collections, code highlighting, search and blocks for documentation sites.
  
  - **Markdown collections:** a collection can store its items as Markdown files (`markdown: { body }` in its settings), with the other fields as YAML front matter. The admin panel's collection settings turn it on and convert every item; the body is edited in the formatted editor or a Markdown tab, and Markdown the formatted editor can't show, such as a table, is edited as Markdown only. `@goodfellow-cms/core` adds `parseMarkdownEntry()`, `serializeMarkdownEntry()`, `markdownToHtml()`, `markdownParts()`, `markdownHeadings()` and `canFormatMarkdown()`; HTML in Markdown is shown as text, and only safe addresses are kept.
  - **Code block:** code highlighted with Shiki when the site is built, with a title and a copy button. Code in Markdown text is highlighted too.
  - **Search block:** searches the site in the visitor's browser with Pagefind. Builds index a site only when a page has a search block (`data-goodfellow-search`); `goodfellow build` does it, `goodfellow index` indexes any built site, and Next.js sites run `goodfellow-next index out` after `next build`. Pages mark their main content for indexing.
  - **Collection navigation**, **Previous and next** and **On this page** blocks, for documentation and other sites with ordered collections.
  - Formatted text styles tables, images and code.
- 1bfecf7: Publishing to GitHub and GitLab. New `@goodfellow-cms/github` and `@goodfellow-cms/gitlab` backends edit a site's repository straight from the browser: GitHub with an access token from a prefilled link, GitLab with one-click OAuth (PKCE) or a token. Set `backend` in `goodfellow.config.tsx` and `goodfellow build` includes the admin panel at `/admin/`, with a sign-in screen, an account menu and a live-site status that follows the deploy after each publish. `@goodfellow-cms/core` adds the `GitHost` and `GitBackend` interfaces, `writeChanges()` (which saves over other people's changes to other files but never the same ones), and `@goodfellow-cms/core/testing` with an in-memory repository for fakes. `goodfellow dev` gives each site its own Vite cache and keeps watching content when folders are replaced.
- 809001e: The admin panel, running against local files. `goodfellow dev` now serves it at `/admin`: edit pages, the header and footer in Puck, and site settings (general, colors and fonts, menus and custom CSS) with a live preview. Classes typed in the editor are styled immediately by Tailwind running in the browser. Saves are single writes that refuse to overwrite changes made since the editor loaded. `@goodfellow-cms/core` adds the `ContentStore` interface, `ConflictError`, `isEditablePath` and reserved page addresses (`/admin`).
- ece9ba5: The media library. A new **Media** screen uploads, replaces and deletes images and files in `public/media/`, saying where a file is used before deleting it. Image fields in blocks, page settings, collection items and site settings get a **Choose image** button that picks from the library or uploads a new file. Large photos are shrunk, JPEGs lose hidden details such as location, SVGs lose scripts, and only file types that can't run code are accepted. Previews show new uploads straight away, and add the site's base path to media addresses. `FileChange` can now carry `bytes`, and every store implements `readBytes()`, with both backends, their fakes and the development server supporting uploads. `@goodfellow-cms/react` adds `mediaField()`, used by the Image and Section blocks, and the AI assistant is told which images the site has.
- 56dbc36: Site settings has Undo and Redo, across every tab, with typing in a field undone as one step; Ctrl+Z and Ctrl+Shift+Z (⌘Z and ⇧⌘Z on a Mac) work outside text fields. Fonts are chosen from a searchable list of Google Fonts, each shown in its own typeface, with "Site default" for each visitor's standard font.
- 8c69eb5: Add `create-goodfellow`, which creates a new site from the starter or the parish example (`npm create goodfellow@latest my-site`), and can set up where the site is stored and hosted. Sites can now keep their contact details (address, phone and email) in Site settings, shown wherever the new Contact details block is placed. A collection's link fields can choose an uploaded file, such as a PDF.

### Patch Changes

- c7ab18e: The item editor leaves out Puck's Blocks and Outline buttons, starts with the AI assistant closed, and gives the fields sidebar a wider width of its own, remembered separately from other editors. The formatted text editor is as tall as the Markdown one.
- 4ca2dc1: Every package has a README, keywords and links to its documentation, repository and issues, for its page on npm. All the packages are released together with the same version.
- d91eea1: The packages are published under the `@goodfellow-cms` scope on npm, such as `@goodfellow-cms/core` and `@goodfellow-cms/react`, since `@goodfellow` was taken. `goodfellow` and `create-goodfellow` keep their names, and the block registry's name in `components.json` and refs such as `@goodfellow/shadcn-faq` stays `@goodfellow`.
- Updated dependencies [1414af7]
- Updated dependencies [fd6f851]
- Updated dependencies [b4b80a6]
- Updated dependencies [5492e22]
- Updated dependencies [2af75b7]
- Updated dependencies [0ed1018]
- Updated dependencies [ce5faee]
- Updated dependencies [88ac239]
- Updated dependencies [652b180]
- Updated dependencies [1bfecf7]
- Updated dependencies [405de70]
- Updated dependencies [809001e]
- Updated dependencies [ece9ba5]
- Updated dependencies [536f2a8]
- Updated dependencies [04fc203]
- Updated dependencies [de03c18]
- Updated dependencies [4ca2dc1]
- Updated dependencies [d91eea1]
- Updated dependencies [8c69eb5]
- Updated dependencies [cff2c58]
- Updated dependencies [3a4c60d]
  - @goodfellow-cms/ai@0.1.0
  - @goodfellow-cms/core@0.1.0
  - @goodfellow-cms/registry@0.1.0
  - @goodfellow-cms/react@0.1.0
