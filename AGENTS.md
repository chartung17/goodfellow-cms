# AGENTS.md

Guidance for anyone, human or coding agent, changing this repository. Read [README.md](README.md) first for what Goodfellow is.

The repo is in early development. When you add a tool or script, update this file in the same change.

## Architecture rules

These hold across the whole codebase. A change that breaks one needs an explicit decision from the maintainer, not a workaround.

1. **No server at runtime.** A deployed site is static files only. The admin panel calls the GitHub or GitLab API directly from the browser. Server-side code is out of scope for now, including the OAuth worker and a Claude connector (MCP server). The planned AI assistant calls AI services straight from the editor's browser. The one exception is the development-only local backend in `goodfellow dev`, which must never ship in a build.
2. **GitHub and GitLab are equal.** Every backend feature goes through the `GitBackend` interface in `@goodfellow/core` and must be implemented for both `@goodfellow/github` and `@goodfellow/gitlab` in the same change. If one host cannot support a feature, the interface must expose that as a capability flag and the admin panel must handle its absence. Nothing outside the backend packages may call a git host API or branch on the host name.
3. **`@goodfellow/core` has no React and no DOM.** It must run in Node and the browser. Type-only imports from `@puckeditor/core` are fine.
4. **The admin panel is built with the site's config.** `@goodfellow/admin` exports a component, not a prebuilt app, so the editor always includes the site's own blocks. The site and its `/admin` page import the same `goodfellow.config.tsx`.
5. **Blocks are configured in code; content is edited in the admin panel.** Block definitions live in code. Everything an admin can change lives under `content/` or `public/media/`, including collection schemas and templates, and must be editable without a developer or a rebuild of the editor.
6. **Site data is separate from layout.** Menus, logo, contact details and similar site-wide data live in `content/site.json` and `content/menus.json`. Header and footer blocks read that data rather than storing their own copies, so a design change never loses links.
7. **No library-specific code in shared packages.** `@goodfellow/blocks` must work with Tailwind alone. Component-library support goes in separate block packs.
8. **No code loaded at runtime from outside the build.** Third-party code runs in the admin panel with the editor's git token, so it is only ever included at build time.

## Content files

Content files are the product's data format; treat changes to them like API changes.

- **One file per page or entry.** `content/pages/about.json` serves `/about`; `content/pages/index.json` serves `/`. Never bundle several pages into one file.
- **Stable output.** Write JSON with 2-space indentation, a trailing newline and a stable key order, so diffs stay small and readable. Use the shared serializer in `@goodfellow/core`; never call `JSON.stringify` on content directly.
- **Versioned.** Every content file has a `version` field. A change to the shape of stored data needs a migration in `packages/core/migrations` and a test that migrates a file from the previous version.
- **Formatting is owned by the serializer.** Biome doesn't format `content/**/*.json`. A test checks that the starter template's content files are in canonical form, so after editing them by hand, re-save them with `serializeContent`.
- **Atomic saves.** A save that touches several files is a single commit. Every write passes the commit the editor started from, so that saving over someone else's change fails and triggers the merge flow instead of silently overwriting.

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
- **Site data:** read menus and settings with `useSite()`. Never copy them into a block's props.
- **No client-side JavaScript yet:** pages are static HTML. Interactive behavior uses HTML and CSS only (`<details>`, `:hover`, `:focus-within`).
- **Labels:** field labels and option names are for non-technical users ("Space above and below", not "padding-y").

## Admin panel

- **Text:** every string goes through `useStrings()` and the table in `packages/admin/src/strings.tsx`. A test fails if any string uses git terms.
- **Saving:** build file changes with the helpers in `packages/admin/src/changes.ts`, so files are always written in canonical form, and publish them through `useAdmin().publish()`, which passes the revision the editor loaded.
- **Local backend:** `@goodfellow/admin/dev` (`localStore()`) is imported only by the dev server's admin entry. Never import it from anything a build includes.
- **Navigation:** link between screens with `AppLink`, which asks before leaving unpublished changes. Screens with unpublished changes call `useUnsavedChanges()`.
- **Previews:** previews render in iframes styled by `usePreviewStyles()`: the site's CSS plus the theme and custom CSS being edited, with `@tailwindcss/browser` generating classes the compiled CSS doesn't have yet.
- **Testing Puck:** Puck renders hidden copies of its fields, so tests select visible ones (`:visible`) and click blocks through their `[data-puck-component]` handle.
- **Dev server watching:** `content/` is excluded from Vite's watcher and watched separately, because Tailwind's Vite plugin reloads every open page when a file it scans changes. That would reload the admin panel on every publish.

## Backends

- **Reads are pinned:** a backend's reads see the revision its last `revision()` call returned, so loading the site is consistent even if someone publishes meanwhile. Trees and blobs are cached by id, since they never change.
- **Saving:** the admin panel publishes through `writeChanges()` from `@goodfellow/core`. It retries on top of other people's commits when they only touched other files, and throws `ConflictError` when they touched the same ones. Backends must throw `ConflictError` when the branch has moved (GitHub: `expectedHeadOid`; GitLab: a branch check plus each file's `last_commit_id`).
- **Sign-in problems** throw `SignInError` with a `problem` the admin panel turns into text. Backends never supply UI text; token links name string-table keys instead.
- **Fakes:** each backend package exports a fake of its host's API from `@goodfellow/<host>/testing`, built on `FakeRepo` from `@goodfellow/core/testing`. Unit tests pass the fake's `fetch`; end-to-end tests route the browser's requests to its `handle` with `routeToFake()`. Never import `/testing` entry points from code that ships.

## Component libraries

shadcn support is on hold until `puckeditor/puck-configs` has a license. Don't copy or adapt any code from that repository until it does.

## Security

- **Tokens:** never log tokens, include them in error messages or URLs, or send them anywhere except the git host's API. Store them only where the user chose (session or local storage), and clear them on sign-out.
- **Custom CSS:** when injecting admin-written CSS into a page, escape anything that could close the `<style>` element.
- **Rich text and embeds:** sanitize rich text when rendering it. Embeds only render in sandboxed iframes or through an allowlisted provider.
- **Tests:** never call the real GitHub or GitLab APIs in tests; use the mocked API fixtures. Never commit real tokens, even expired ones.

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
- **TypeScript 7:** tsdown warns that TypeScript 7's API is experimental. That warning is expected.
- **Trying a change in a real site:** run `pnpm build`, then `pnpm dev` in `templates/starter` and open http://localhost:4321 (or http://localhost:4321/admin). Pages re-render on every request, so content edits show up on reload. The dev server runs the built `dist/` of each package, so rebuild a package after changing it.
- **End-to-end tests:** `pnpm test:e2e` runs Playwright against `goodfellow dev` serving a copy of the starter site in `e2e/.site` (reset before every test), and against production builds of the starter with each git backend (`e2e/.site-github` and `e2e/.site-gitlab`), whose API calls go to the fakes. Install a browser once with `pnpm --filter @goodfellow/e2e exec playwright install chromium`, or point `PLAYWRIGHT_CHROMIUM_EXECUTABLE` at a Chromium that's already installed.

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
| Block pack | A package of blocks for one component library |
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
