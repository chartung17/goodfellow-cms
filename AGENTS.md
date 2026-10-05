# AGENTS.md

Guidance for anyone, human or coding agent, changing this repository. Read [README.md](README.md) first for what Goodfellow is.

The repo is in early development. Several tools and scripts below are decided but not set up yet; when you add one, update this file in the same change.

## Architecture rules

These hold across the whole codebase. A change that breaks one needs an explicit decision from the maintainer, not a workaround.

1. **No server at runtime.** A deployed site is static files only. The admin panel calls the GitHub or GitLab API directly from the browser. Server-side code is out of scope for now, including the OAuth worker and Puck AI. The one exception is the development-only local backend in `goodfellow dev`, which must never ship in a build.
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
- **Atomic saves.** A save that touches several files is a single commit. Every write passes the commit the editor started from, so that saving over someone else's change fails and triggers the merge flow instead of silently overwriting.

## Puck

- Use `@puckeditor/core`. `@measured/puck` is the old package name; don't import it.
- Puck is pre-1.0 and its minor versions have breaking changes. Pin an exact version in every package, and upgrade it in one dedicated change across the workspace.
- Prefer Puck's own APIs (slots, the `metadata` API, `richtext` fields, plugins, overrides, the dictionary) over reimplementing them.

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

Once the workspace exists, run these from the repo root before every commit:

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

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
