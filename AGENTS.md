# AGENTS.md

Guidance for anyone, human or coding agent, changing this repository. Read [README.md](README.md) first for what Goodfellow is.

The repo is in early development. When you add a tool or script, update this file in the same change.

## Architecture rules

These hold across the whole codebase. A change that breaks one needs an explicit decision from the maintainer, not a workaround.

1. **No server at runtime.** A deployed site is static files only. The admin panel calls the GitHub or GitLab API directly from the browser. Server-side code is out of scope for now, including the OAuth worker and a Claude connector (MCP server). The AI assistant (`@goodfellow/ai`) calls AI services straight from the editor's browser, with each editor's own key. Next.js sites are exported as static files too. The one exception is the development-only local backend in `goodfellow dev` and `next dev`, which must never ship in a build.
2. **GitHub and GitLab are equal.** Every backend feature goes through the `GitBackend` interface in `@goodfellow/core` and must be implemented for both `@goodfellow/github` and `@goodfellow/gitlab` in the same change. If one host cannot support a feature, the interface must expose that as a capability flag and the admin panel must handle its absence. Nothing outside the backend packages may call a git host API or branch on the host name.
3. **`@goodfellow/core` has no React and no DOM.** It must run in Node and the browser. Type-only imports from `@puckeditor/core` are fine. The one exception is `@goodfellow/core/node` (`src/node*.ts`, checked with `tsconfig.node.json`): reading sites from disk, the local file store and the development API, for Node only.
4. **The admin panel is built with the site's config.** `@goodfellow/admin` exports a component, not a prebuilt app, so the editor always includes the site's own blocks. The site and its `/admin` page import the same `goodfellow.config.tsx`.
5. **Blocks are configured in code; content is edited in the admin panel.** Block definitions live in code. Everything an admin can change lives under `content/` or `public/media/`, including collection schemas and templates, and must be editable without a developer or a rebuild of the editor.
6. **Site data is separate from layout.** Menus, logo, contact details and similar site-wide data live in `content/site.json` and `content/menus.json`. Header and footer blocks read that data rather than storing their own copies, so a design change never loses links.
7. **No library-specific code in shared packages.** `@goodfellow/blocks` must work with Tailwind alone. Blocks built with a component library come from block registries (see Component libraries).
8. **No code loaded at runtime from outside the build.** Third-party code runs in the admin panel with the editor's git token, so it is only ever included at build time.

## Content files

Content files are the product's data format; treat changes to them like API changes.

- **One file per page or entry.** `content/pages/about.json` serves `/about`; `content/pages/index.json` serves `/`. Never bundle several pages into one file.
- **Stable output.** Write JSON with 2-space indentation, a trailing newline and a stable key order, so diffs stay small and readable. Use the shared serializer in `@goodfellow/core`; never call `JSON.stringify` on content directly.
- **Versioned.** Every content file has a `version` field. A change to the shape of stored data needs a migration in `packages/core/migrations` and a test that migrates a file from the previous version.
- **Formatting is owned by the serializer.** Biome doesn't format `content/**/*.json`. A test checks that the starter's and the examples' content files are in canonical form, so after editing them by hand, re-save them with `serializeContent`.
- **Atomic saves.** A save that touches several files is a single commit. Every write passes the commit the editor started from, so that saving over someone else's change fails and triggers the merge flow instead of silently overwriting.

## Collections

- **Files:** a collection is a folder, `content/collections/<id>/`, holding `_collection.json` (its name, item name, fields, optional address pattern such as `/videos/{slug}`, optional sort order and Puck template) and one `<slug>.json` per entry with the entry's `fields`. Every collection has a text field named `title`.
- **Stable names:** like block props, a collection's folder name and its fields' `name`s are what content refers to. The admin panel never renames them, and a field's type can't change once published.
- **No stale values:** removing a field or a choice removes it from every entry in the same save (`collectionSettingsChanges()`), because the loader rejects values that don't match their field.
- **Addresses:** `allPages()` lists pages and entries' pages together. Use it wherever addresses are served or checked, so an entry can never take a page's address or the other way round.
- **Templates:** `{name}` placeholders in any text prop are filled in by `applyEntry()`, escaped in rich text. Blocks that need the entry itself read `useSite().entry` and `useSite().collection`, or Puck's `metadata` in `resolveFields` and `resolveData`. Wrap blocks that only make sense in templates in `templateOnly()`, which leaves them out of the page, header and footer editors.
- **Rich text from entries** is rendered through a hidden `richtext` field that `resolveData` fills in, so Puck sanitizes it like any other rich text. Never render an entry's HTML directly.

## AI assistant

- **Split:** `@goodfellow/ai` builds requests, checks answers and talks to AI services, with no React. The panel itself is in the admin panel (`ai-panel.tsx`), a Puck plugin in every editor, with its text in the string table.
- **Answers as data:** blocks come back as a flat list with parent ids, because structured outputs can't describe nesting. Always turn answers into content with `toContent()` or `toValues()`, which drop anything that doesn't fit the site's fields. Never use an answer as it came, since free services don't always follow the schema.
- **Custom fields** don't say what they hold, so give them `metadata: { ai: … }` (an `AiFieldHint`) for the assistant to fill them in.
- **Claude** is called through the official `@anthropic-ai/sdk`, loaded only when used, with structured outputs and server-side safety fallbacks. Other services use the OpenAI-compatible chat API. Don't call Claude through an OpenAI-compatible endpoint.
- **New services** must allow requests from browsers (CORS), or they can't work without a server.

## Puck

- Use `@puckeditor/core`. `@measured/puck` is the old package name; don't import it.
- Puck is pre-1.0 and its minor versions have breaking changes. Pin an exact version in every package, and upgrade it in one dedicated change across the workspace.
- Prefer Puck's own APIs (slots, the `metadata` API, `richtext` fields, plugins, overrides, the dictionary) over reimplementing them.

## Blocks

- **Never rename** a block's key in a site's `blocks` or any of its props. Content files refer to blocks and props by name, so a rename needs a content migration.
- **CSS classes:** every block has a `className` prop. Declare `className: classNameField` and apply it to the block's outermost element. A block that doesn't declare it gets wrapped in a `<div>` that carries the classes.
- **Combining classes:** use `cx()` from `@goodfellow/react`, with `className` last. It uses tailwind-merge, so an editor's classes override the block's defaults instead of conflicting with them.
- **Complete class names:** write Tailwind classes as complete strings, using lookup tables for options (`{ sm: "gap-3", md: "gap-6" }`). Never build class names from parts, or Tailwind won't find them.
- **Theme tokens:** style with theme classes (`bg-primary`, `text-muted-foreground`, `font-heading`, `rounded-lg`) rather than fixed colors, so blocks follow the site's theme.
- **Site data:** read menus, settings and collections with `useSite()`. Never copy them into a block's props.
- **Links and images:** render them with `SiteLink` and `SiteImage` from `@goodfellow/react`, never `<a>` and `<img>`, so they follow the site's base path and use the renderer's components (`next/link`, `next/image`). Any other root-relative address, such as a CSS background, goes through `withBase(url, useSite().base)`.
- **Interactive parts** go in a Client Component, a file starting with `"use client"`, which may use any hooks; pass it plain values and content (`children`) only. They run in the browser with Next.js and `goodfellow build` alike (see Islands). A page with one loads React, so avoid Client Components in built-in blocks and examples where HTML and CSS will work (`<details>`, `:hover`, `:focus-within`).
- **No hooks in `render` itself**, other than `useSite()`: blocks render as Server Components in Next.js, where hooks such as `useState` fail.
- **Labels:** field labels and option names are for non-technical users ("Space above and below", not "padding-y").

## Admin panel

- **Text:** every string goes through `useStrings()` and the table in `packages/admin/src/strings.tsx`. A test fails if any string uses git terms.
- **Saving:** build file changes with the helpers in `packages/admin/src/changes.ts`, so files are always written in canonical form, and publish them through `useAdmin().publish()`, which passes the revision the editor loaded.
- **Local backend:** `@goodfellow/admin/dev` (`localStore()`) is imported only by the dev server's admin entry, and by `GoodfellowAdmin` behind a `process.env.NODE_ENV === "development"` check that `next build` removes. Never import it from anything a build includes; a test checks the Next.js export doesn't contain it.
- **Navigation:** link between screens with `AppLink`, which asks before leaving unpublished changes. Screens with unpublished changes call `useUnsavedChanges()`.
- **Previews:** previews render in iframes styled by `usePreviewStyles()`: the site's CSS plus the theme and custom CSS being edited, with `@tailwindcss/browser` generating classes the compiled CSS doesn't have yet. It also keeps media showing (see Media).
- **Testing Puck:** Puck renders hidden copies of its fields, so tests select visible ones (`:visible`) and click blocks through their `[data-puck-component]` handle.
- **Fonts:** Site settings offers the families in `src/google-fonts.ts`, which `pnpm --filter @goodfellow/admin update-fonts` (`scripts/google-fonts.mjs`) writes from Google Fonts' list; commit what it writes. The list is loaded only when a font picker opens.
- **Undo:** forms with their own history use `useHistory()` from `history.ts`, which joins typing in one field into one step and handles Ctrl+Z outside text fields.
- **Dev server watching:** `content/` and `public/media/` are excluded from Vite's watcher, because Tailwind's Vite plugin reloads every open page when a file it scans changes. That would reload the admin panel on every publish. `content/` is watched separately, and `goodfellow dev` serves `/media/` from disk itself.

## Next.js

- **Server Components:** Next.js renders Goodfellow pages as Server Components, which have no React context. `@goodfellow/react` has a second entry for them (`index.server.ts`, the `react-server` export condition) whose `SiteProvider` and `useSite()` keep the site in React's per-request `cache()` instead, and whose `PageBody` uses Puck's server `Render`. Export the same names from both entries; a test checks they match.
- **Per-page site data:** Next.js renders the "not found" page in the same request as every other page, so a single per-request value is ambiguous. The server entry's Puck config wraps each block's `render` to `setSite()` its own page's site first; a block and the components it renders run in one pass. Never rely on `SiteProvider` alone on the server.
- **Client Components** in blocks get the site through the browser entry's context: the server `SiteProvider` also renders the `"use client"` `SiteProvider` from `site-context.tsx`, so the site, including `components` (which must be client references, as `NextLink` and `NextImage` in `packages/next/src/components.tsx` are), is passed to the browser. Keep context and other browser-only code out of modules the server entry imports, or Next.js refuses to build. `site-context.tsx` is its own build entry so its directive survives bundling.
- **Same HTML:** pages must render the same HTML in Next.js as with `goodfellow build`, apart from what `next/link` and `next/image` add. A test in `packages/next` compares the Next.js starter's export with the starter's build, so `templates/next` keeps the starter's `content/` and `public/` exactly. Shared preparation (entries, `resolveData`, base paths in rich text) lives in `preparePage()`.
- **Puck's server `Render`** puts `puck.metadata` in a block's props before looking for slots in them, so metadata keys that match a slot's name (an entry's `content`, a Section's `content`) break it. `hiddenFromSlots()` works around this; remove it once Puck fixes it.
- **Development:** `withGoodfellow()` runs the local backend on a random port on 127.0.0.1 in `next dev`, and Next.js rewrites `/__goodfellow/api/*` to it. The API trusts any page on this computer (`isLocalOrigin`) since requests arrive through Next.js's address.
- **Base path:** `withGoodfellow()` takes `basePath`, or `GOODFELLOW_BASE`, and passes it to pages and the admin panel as `GOODFELLOW_BASE_PATH`. `goodfellow build` rewrites finished HTML instead (`applyBasePath`), so it leaves `useSite().base` unset; Next.js can't rewrite its output, so pages get `base` and blocks add it through `SiteLink`, `SiteImage` and `withBase`. `next/link` adds the base path itself; `next/image` doesn't, so `SiteImage` passes it the full address.
- **Images:** `readMediaSizes()` (cached by modification time) gives `next/image` each image's size. Without a custom loader, `withGoodfellow()` sets `images.unoptimized`, since a static export can't optimize images.
- **Routes:** the page route leaves `dynamicParams` on, so `next dev` shows pages created in the admin panel at once; the export only contains `generateStaticParams`' pages.

## Islands

How `goodfellow build` and `goodfellow dev` run Client Components in the browser. Next.js does this itself and uses none of it.

- **Finding them:** `islandsPlugin()` in `packages/cli/src/islands.ts` works where the server loads pages' modules. Where a module that isn't `"use client"` imports one that is, it gets an island module instead, with each export wrapped in `island()` from `@goodfellow/react/island`. Client Components importing each other get the real module, as in the browser, so hooks, contexts and helpers they share keep working. The modules found feed the browser's entry, `virtual:goodfellow/islands`, which loads each one only on pages that use it. Modules of the packages that render pages (`@goodfellow/react`, Puck, React) are never islands. Packages of blocks (the site's packages that use `@goodfellow/react`) are `ssr.noExternal`, so Vite loads them and their Client Components are found too.
- **On the server**, `island()` renders the component as its own React root with an `identifierPrefix`, as `hydrateIslands()` in `hydrate.tsx` does in the browser, so `useId()` matches. Inside another island, a Client Component renders as it is. Props go into the page as JSON, and anything else is refused with a plain error, as Next.js does. Content props (`children` and other JSX) are rendered by the page in `<template>`s, which `fillSlots()` moves into the island's `<gf-slot>`s; the browser keeps that HTML as it is and starts islands inside it on their own.
- **Pages:** `createPageRenderer` adds the site's data (`useSite()`, with `base` for `goodfellow build`) and the script only to pages with an island; other pages need neither.
- **Production builds:** Vite takes production mode from `NODE_ENV`, which its server for rendering pages sets to `"development"`, so `build()` sets it to `"production"` for the build.

## Media

- **Files** live in `public/media/` and content refers to them as `/media/name.jpg`. Uploads are binary `FileChange`s (`{ path, bytes }`), and every `ContentStore` implements `readBytes()`.
- **Media fields:** a prop that holds a media address uses `mediaField()` from `@goodfellow/react`, which marks it with `metadata: { media: "image" | "file" }`. The admin panel adds the media library's chooser to those fields in Puck; its own forms use `MediaField`.
- **Uploads** go through `prepareUpload()`, which refuses file types that could run code, shrinks large photos, re-saves JPEGs to drop hidden details such as location, and removes scripts from SVGs. Keep the allowed types in `media.ts` to ones that can't run code on the site's address.
- **Previews** never use `/media/` addresses as they are: `showMediaInPreview()` adds the site's base path, shows new uploads from memory, and reads files the live site doesn't have yet from the repository.

## Backends

- **Reads are pinned:** a backend's reads see the revision its last `revision()` call returned, so loading the site is consistent even if someone publishes meanwhile. Trees and blobs are cached by id, since they never change.
- **Saving:** the admin panel publishes through `writeChanges()` from `@goodfellow/core`. It retries on top of other people's commits when they only touched other files, and throws `ConflictError` when they touched the same ones. Backends must throw `ConflictError` when the branch has moved (GitHub: `expectedHeadOid`; GitLab: a branch check plus each file's `last_commit_id`).
- **Sign-in problems** throw `SignInError` with a `problem` the admin panel turns into text. Backends never supply UI text; token links name string-table keys instead.
- **Fakes:** each backend package exports a fake of its host's API from `@goodfellow/<host>/testing`, built on `FakeRepo` from `@goodfellow/core/testing`. Unit tests pass the fake's `fetch`; end-to-end tests route the browser's requests to its `handle` with `routeToFake()`. Never import `/testing` entry points from code that ships.

## Component libraries

Blocks built with a component library come from block registries: shadcn registries whose items are Goodfellow blocks. Goodfellow publishes one for shadcn/ui (roadmap step 10) and builds no other library's blocks. Others can publish registries for other libraries in the same documented format. The design:

- **Installing** copies an item's files, and those of its `registryDependencies`, into the site in one commit, as the shadcn CLI would. The admin panel does this itself, so no developer is needed. Installed blocks are picked up from a folder with no config change, and appear in the editor once the site has rebuilt.
- **A record** of installed blocks (where each came from, its version and a hash of its files) lets the admin panel list them, and updates replace only files nobody has changed.
- **Removing** a block that any page, template, header or footer uses is refused, since content refers to blocks by name.
- **Trust:** installed code runs in the admin panel with the editor's git token (rule 8), so the admin panel installs only from Goodfellow's registry and registries the site's config lists.
- **Packages:** the admin panel can't update a lockfile, so sites include every npm package Goodfellow's registry uses, and its blocks use nothing else.
- **Stable names:** a registry item's name is its block's key in content, so it never changes.

Don't copy or adapt any code from `puckeditor/puck-configs` until that repository has a license.

## Security

- **Tokens:** never log tokens, include them in error messages or URLs, or send them anywhere except the git host's API. Store them only where the user chose (session or local storage), and clear them on sign-out.
- **AI keys** follow the same rules: sent only to their own service, kept only where the editor chose, cleared on sign-out, and removed from error messages with `redact()`.
- **Custom CSS:** when injecting admin-written CSS into a page, escape anything that could close the `<style>` element.
- **Rich text and embeds:** sanitize rich text when rendering it. Embeds only render in sandboxed iframes or through an allowlisted provider.
- **Tests:** never call the real GitHub, GitLab or AI services' APIs in tests; use the fakes (`@goodfellow/ai/testing` for AI services). Never commit real tokens or keys, even expired ones.

## Writing for non-technical users

The admin panel is for people who have never used git.

- **No git jargon in the UI.** Say "Publish" (not commit or push), "Submit for review" (not pull or merge request), "Someone else changed this page" (not merge conflict) and "Version history" (not commit log).
- **Errors** say what happened and what to do next, in plain language. Put technical details behind a "Details" toggle.
- **Admin settings** have a sensible default, so a new site works without configuration.
- **UI text** goes through Puck's dictionary or our own string table, never hard-coded, so the admin panel can be translated.

## Tooling

| Purpose | Tool |
|---|---|
| Package manager | pnpm (workspaces) |
| Task runner | Turborepo |
| Language | TypeScript, strict mode, ESM only |
| Library builds | tsdown |
| Lint and format | Biome |
| Unit tests | Vitest, test files next to the code as `*.test.ts(x)` |
| End-to-end tests | Playwright, in `e2e/` |
| Versioning and changelogs | Changesets |
| Node | 22 or later |

Run these from the repo root before every commit. CI runs the same steps.

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

- **Order:** tests and typechecks use other workspace packages' built `dist/` folders, so Turborepo builds dependencies first. If you run Vitest directly inside one package, run `pnpm build` first.
- **TypeScript 7:** tsdown warns that TypeScript 7's API is experimental. That warning is expected. The Next.js starter uses TypeScript 5.9, because `next build` type-checks through TypeScript's JavaScript API.
- **Next.js:** `pnpm build` runs `next build` for `templates/next`, which writes `out/`. `next dev` and `next build` may rewrite its `tsconfig.json`; commit what they write. `@goodfellow/next` embeds the theme's CSS and Tailwind for the browser as text (`scripts/embed.mjs`, into the ignored `src/generated/`), since Next.js can't import them as text.
- **Trying a change in a real site:** run `pnpm build`, then `pnpm dev` in `templates/starter` (or `examples/parish`) and open http://localhost:4321 (or http://localhost:4321/admin). Pages re-render on every request, so content edits show up on reload. The dev server runs the built `dist/` of each package, so rebuild a package after changing it.
- **End-to-end tests:** `pnpm test:e2e` runs Playwright against `goodfellow dev` serving a copy of the starter site in `e2e/.site` (reset before every test), against production builds of the starter with each git backend (`e2e/.site-github` and `e2e/.site-gitlab`), whose API calls go to the fakes, against `next dev` serving a copy of the Next.js starter (`e2e/.site-next`), and against a static export of the Next.js starter served from `/site/` (`e2e/.site-next-base`). The Next.js copies use the template's installed packages. Every copy but the subfolder export also has interactive test blocks from `e2e/fixtures/blocks`, which `islands.spec.ts` runs on each. Install a browser once with `pnpm --filter @goodfellow/e2e exec playwright install chromium`, or point `PLAYWRIGHT_CHROMIUM_EXECUTABLE` at a Chromium that's already installed.

## Starters and examples

- **Sites:** `templates/starter` is the default site, `templates/next` the same site as a Next.js app, and `examples/parish` a complete example. `create-goodfellow` copies any of them, leaving out build output and `turbo.json`. Both are workspace packages, so they run against the workspace's packages, and their `package.json` files use `workspace:*`, which `create-goodfellow` replaces with published versions.
- **Bundling:** `create-goodfellow`'s build copies the sites into its `templates/` folder (`scripts/bundle-templates.mjs`), with every package's version in `templates/versions.json`. It depends on them so Turborepo rebuilds it when they change. A new example needs adding there and to `TEMPLATES` in `scaffold.ts`.
- **Setup lines:** `create-goodfellow` turns on the commented-out `backend` lines in `goodfellow.config.tsx` and removes other hosts' setup files, so keep those lines and file names as they are in every site.
- **Shared files:** the examples' deploy setups, `.gitignore` and `src/styles.css` must match the starter's; a test checks this. The Next.js starter has its own, which build with `next build` and publish `out/`.
- **Made-up content only:** examples use invented names, addresses (`example.org` email addresses and 555-01xx phone numbers), events and text, and pictures drawn for the purpose. Never use a real organization's details, photos or copyrighted text such as modern Bible translations. Scripture comes from the Douay-Rheims Bible (Challoner revision), a Catholic translation in the public domain.

## Conventions

- **Exports:** use named exports. Each package exposes its public API from `src/index.ts`; anything not exported there is internal.
- **Dependencies:** keep runtime dependencies small. Every package that ships to the browser counts against the editor's load time, and anything in `@goodfellow/react` also ships to every visitor of every site.
- **Changesets:** any change to a published package needs one (`pnpm changeset`).
- **Docs:** when a change affects what users see or do, update README.md in the same change, including the roadmap.

## Terminology

Use these terms consistently in code, UI and docs.

| Term | Meaning |
|---|---|
| Site | One website, stored in its own git repository |
| Page | A single URL whose content is Puck data in `content/pages/` |
| Block | A component that can be placed in the editor (a Puck component) |
| Block registry | A shadcn registry whose items are Goodfellow blocks, which sites install blocks from |
| Layout | The header and footer, edited in Puck |
| Site settings | Title, favicon, metadata, theme colors, fonts (`content/site.json`) |
| Menu | A named list of navigation links (`content/menus.json`) |
| Collection | A group of similar pages sharing one template, such as videos |
| Template | The Puck layout shared by every entry in a collection |
| Entry | One item in a collection: field values only |
| Backend | A `GitBackend` implementation for one git host |
| Publish | Commit changes to the site's main branch |

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
