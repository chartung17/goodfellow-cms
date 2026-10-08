# Goodfellow

A git-based website builder built on the [Puck](https://puckeditor.com) visual editor.

Goodfellow gives non-technical site owners a drag-and-drop editor at `/admin` with no server, database or monthly hosting bill. Pages are stored as files in the site's own GitHub or GitLab repository. Every save is a commit, and a free static host (GitHub Pages, GitLab Pages or Vercel) rebuilds the site.

> **Status: early development.** Static rendering, the admin panel, collections, the AI assistant, the media library, blocks from Goodfellow's shadcn/ui block registry, demo mode, Markdown collections, code highlighting and search, publishing to GitHub or GitLab, `create-goodfellow` and the Next.js adapter work, with deploy setups for GitHub Pages, GitLab Pages and Vercel. Nothing is published to npm yet. This README describes what Goodfellow is meant to become; the [roadmap](#roadmap) shows what exists. The [documentation site](docs/), built with Goodfellow, goes online in step 13.

## How it works

```
Editor's browser                       Git host (GitHub / GitLab)          Static host
┌──────────────────────┐   API calls   ┌──────────────────────┐   push    ┌──────────────┐
│ /admin               │ ────────────▶ │ content/*.json       │ ────────▶ │ build + serve│
│ Puck editor + forms  │ ◀──────────── │ public/media/*       │  trigger  │ static HTML  │
└──────────────────────┘               └──────────────────────┘           └──────────────┘
```

- **No server.** The admin panel is part of the static site and talks to the GitHub or GitLab API straight from the browser.
- **Instant preview.** The editor renders pages in the browser, so editors see changes before anything is published.
- **Publishing is a commit.** A commit to the main branch triggers the host's normal build. The admin panel shows when the new version is live.
- **Content is plain files.** One JSON file per page, readable in any diff and portable to other tools.

## Features

Planned for the first release:

- **Visual page editing** with Puck, using layout blocks (Grid, Flex, Image, Video, Embed, Rich text and more) that work without any component library.
- **Header and footer built in Puck**, with navigation menus stored separately so links survive a change of design.
- **Site settings** in the admin panel: title, favicon, metadata, theme colors and fonts.
- **Collections and templates.** Build a layout once (for example `/videos/{slug}`), then add entries by filling in a simple form. A collection can store its items as Markdown files.
- **Code and search.** A Code block highlights code when the site is built, and a Search block searches the whole site in the visitor's browser with [Pagefind](https://pagefind.app).
- **AI assistant.** Describe what you want and AI writes it into the page, rewrites a block, or fills in an item's fields. Editors choose the AI service: Claude, OpenAI, a free service, or any chat app by copy and paste.
- **Class names and custom CSS.** Any block can take Tailwind classes, and admins can write site-wide CSS. Classes appear in the editor preview immediately, before the site is rebuilt.
- **More blocks without a developer.** Admins add blocks built with [shadcn/ui](https://ui.shadcn.com), such as an FAQ, tabs and a pricing table, from the admin panel, and remove them again. Developers can publish registries of blocks built with other libraries.
- **Custom blocks** for developers: any React component can become a block.
- **Interactive blocks.** Blocks can use React Client Components, which run in the browser with or without Next.js. Pages without them load no JavaScript at all.
- **Sign-in without a server:**
  - **GitHub:** a "Sign in" button opens GitHub's token page with the right permissions already filled in.
  - **GitLab:** one-click OAuth sign-in (PKCE), after the site owner registers an OAuth application once.
- **Deploy setups** for GitHub Pages, GitLab Pages and Vercel, including a nightly rebuild for time-based content.
- **Works with or without a framework.** A standalone command-line tool builds the site with no framework at all, or the site can be part of a Next.js app.

Planned for later: OAuth sign-in for GitHub via a small Cloudflare Worker, a Claude connector for editing the site from a chat, review workflows (pull/merge requests from the admin panel), per-user permissions, import/export, plugins and themes, and Bitbucket support.

## Requirements and limits

Goodfellow runs entirely on free tiers, but those tiers have limits worth knowing about:

| | GitHub Free | GitLab Free |
|---|---|---|
| Free static hosting | GitHub Pages, **public repos only** | GitLab Pages, public or private |
| Editors | Unlimited collaborators | Up to 5 users in a private group or account; unlimited if public |
| Build minutes | Unlimited for public repos, 2,000/month for private | 400/month (or build on Vercel instead) |
| Sign-in | Personal access token (fine-grained, or classic for collaborators) | OAuth (PKCE) or personal access token |

**Commercial sites:** each host's free plan has its own rules about business use, so check them before choosing:

- **GitHub Pages** isn't allowed for running an online business, a shop, or any site mainly for selling things or software as a service ([GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). It also shouldn't handle passwords or card numbers.
- **Vercel's free Hobby plan** is for personal, non-commercial use only. Vercel counts a site as commercial if anyone involved in making it gains financially, including a developer paid to build or update it, and if it takes payments, advertises products or services for sale, or shows ads. Asking for donations is allowed ([Vercel fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)).
- **GitLab Pages:** we haven't found a rule against business sites on GitLab's free plan, so it's the free option to use for one. Check [GitLab's terms](https://about.gitlab.com/terms/) for your own case.

These are the hosts' rules, not Goodfellow's, and they can change. Goodfellow's documentation will keep them current.

**GitHub sign-in:** GitHub doesn't let collaborators on someone else's repository use fine-grained tokens. For sites with several editors, put the repository in a free GitHub organization and add editors as members; otherwise collaborators need a classic token.

## Getting started

Create a new site with Node 22 or later:

```sh
npm create goodfellow@latest my-site
```

It asks which site to start from, where the site will be stored (GitHub or GitLab), where it will be hosted, with each host's rules for business sites, and whether to start with the recommended [shadcn blocks](#blocks-from-block-registries) or the built-in blocks only, and sets the site up to match. Three sites are available:

- **Starter** (`templates/starter`): a home page, an about page and a news section.
- **Parish example** (`examples/parish`): a made-up parish with Mass times, events, news, bulletins and staff, and blocks of its own. It shows what a complete site looks like and how a developer adds blocks.
- **Starter for Next.js** (`templates/next`): the starter as a Next.js app, for developers who want their own Next.js pages beside the site's. See [Next.js](#nextjs).

To skip the questions, give the answers as options: `npm create goodfellow@latest my-site -- --template parish --github your-name/your-site --host github-pages --blocks built-in`. Run it with `--help` for the full list.

Until Goodfellow is published to npm, `npm create goodfellow` doesn't work yet, so try the sites in this repository instead. The repository is a pnpm workspace: its sites use the repository's own packages (`workspace:*` in their `package.json`), so `npm install` fails inside them. Get pnpm with `corepack enable` (or `npm install -g pnpm`), then run:

```sh
pnpm install    # from the repository's root
pnpm build
cd templates/starter   # or examples/parish; templates/next has its own commands
pnpm dev        # site at http://localhost:4321, admin panel at http://localhost:4321/admin
pnpm build      # writes the static site to dist/
pnpm preview    # serves dist/ the way a static host would
```

To put a site online, follow [the starter's README](templates/starter/README.md): it covers storing the site on GitHub or GitLab, choosing a host, and setting up sign-in.

### Next.js

`@goodfellow/next` puts a Goodfellow site in a Next.js app (App Router, Next.js 16), exported as static files so the same free hosts serve it. [The Next.js starter](templates/next/README.md) has it all set up:

- `withGoodfellow()` in `next.config.ts` exports static files with a folder per page, serves the site from `basePath` (or the `GOODFELLOW_BASE` environment variable, as `goodfellow build` does), and in `next dev` runs the admin panel's local backend, which saves to the files on disk. The local backend is never part of a build.
- `goodfellowPages(config)` gives the routes their parts: `Layout` for `app/(site)/layout.tsx`, which shows the header and footer once around every page, so they stay as they are when moving between pages (menus mark the current page in the browser, since a layout doesn't know it); `Page`, `generateStaticParams` and `generateMetadata` for `app/(site)/[[...path]]/page.tsx`; `NotFound` for `app/not-found.tsx`, with the header and footer of its own, since Next.js shows it outside the layout; `sitemap` and `robots`, and `demoContent` for `app/admin/demo-content.json/route.ts`, which serves a [demo's](#demo-mode) copy of the content (an empty file on other sites, since a static export can't leave a route out).
- `<GoodfellowAdmin config={config} />` from `@goodfellow/next/admin` is the admin panel, in a Client Component at `app/admin/page.tsx`.
- Pages render as Server Components. Blocks' links to the site's pages use `next/link`, so moving between pages doesn't reload, and the site's images use `next/image` with their sizes filled in. Images are served as they are unless the site sets a [custom image loader](https://nextjs.org/docs/app/api-reference/components/image#loader), since a static export can't resize them on request.
- Blocks can render Client Components (`"use client"`) with any React hooks, and they run in the browser. They can read the site with `useSite()`.
- The starter's build script runs `goodfellow-next index out` after `next build`, which writes the [search index](#search) if a page has a Search block.

**Compared with `goodfellow build`:** interactive blocks work with both, but `goodfellow build` runs each Client Component as a separate [island](#interactive-blocks), which has limits that more interactive sites run into:

- **No shared context.** Each island is its own React app, so a Client Component that provides a context (a theme, a cart, a signed-in user) can't pass it to Client Components in the content it wraps. Islands that need to share state have to do it outside React, such as through a module-level store or browser events. In Next.js, the provider's context reaches every Client Component inside it.
- **Content is fixed HTML.** Content a block passes to a Client Component (`children`) arrives as HTML, so the component can show, hide or move it, but can't look inside it or change it with `React.Children` or `cloneElement`.
- **Fewer kinds of props.** Props must be JSON: no dates, `Map`s, `Set`s or promises, which Next.js can pass.
- **Every page is a full page load.** Moving to another page reloads it, so React and the page's components start again. Next.js moves between pages without reloading.
- **Other packages' Client Components** need re-exporting from a `"use client"` file of the site's, unless they come from a package of blocks. Next.js uses them as they are.

Next.js suits developers who want any of these, client-side navigation, their own Next.js pages beside the site's, or Next.js's ecosystem. It costs more: each page loads Next.js's JavaScript and carries its own content again as data (plus the site's data when it has Client Components), builds take longer, and there are more dependencies to keep up to date. Most of Next.js's server features don't apply, because Goodfellow sites are static. For a content site, with a few interactive parts at most, `goodfellow build` is lighter and simpler.

### Commands

| Command | What it does |
|---|---|
| `goodfellow dev` | Serves the site, rendering each page from the files on disk and reloading it when content changes, plus the admin panel at `/admin`, which saves to those files |
| `goodfellow build` | Writes one HTML file per page to `dist/`, builds the CSS and copies `public/`. Also writes `sitemap.xml` and `robots.txt` if the site's address is set, the admin panel at `/admin/` if the config has a `backend` or is a [demo](#demo-mode), the JavaScript for [Client Components](#interactive-blocks) if blocks use any, and a [search index](#search) if a page has a Search block. |
| `goodfellow preview` | Serves `dist/`, including the 404 page |
| `goodfellow index` | Writes the [search index](#search) for a site built another way |

Options: `--root <dir>`, `--out <dir>`, `--port <port>`, and `--base <path>` for sites served from a subfolder, such as `/my-repo/` on GitHub Pages.

The base path comes from `--base`, then the `GOODFELLOW_BASE` environment variable, then `base` in `goodfellow.config.tsx`. Every root-relative link and image in the built pages is adjusted to match, including links inside rich text. The site's address (`url` in `content/site.json`) should be the full public address, subfolder included.

### The admin panel

The admin panel is at `/admin` on the live site, and while `goodfellow dev` is running. Everything there is written for people who have never used git.

- **Pages:** create pages, edit them in Puck, change a page's address (updating menu links to it), and delete pages. The editor shows the site's header and footer around the page, styled exactly like the live site.
- **Collections:** groups of similar items, such as videos, events or staff. Create a collection, choose its fields (short or long text, formatted text, numbers, dates, links, images and choices from a list), and design the page every item shares in Puck. Then add items by filling in their fields, with a live preview of the item's page. A link field can point to an uploaded file, such as a PDF. Removing a field removes it from every item in the same publish. A collection can store its items as Markdown files instead of JSON: its text is then edited in the formatted editor or as Markdown, and text the formatted editor can't show, such as a table, only as Markdown.
- **Header & footer:** edit them in Puck, like pages.
- **Blocks:** add blocks from [block registries](#blocks-from-block-registries) to the editor, and remove them. Blocks the site doesn't use can be removed; for one it does, the admin panel lists where it's used.
- **Site settings:** the site's name, address, logo and icons; contact details; colors, fonts and corner rounding; menus; and custom CSS. A preview of the home page shows changes as you type, and Undo and Redo work across every tab. Fonts are chosen from a searchable list of Google Fonts, each shown in its own typeface.
- **Live styling:** CSS classes typed into a block, and custom CSS (including Tailwind's `@apply`), take effect in the editor immediately, before the site is rebuilt.
- **Signing in:** on the live site, editors sign in with GitHub or GitLab. GitHub uses an access token, created from a link that fills in the right permissions. GitLab offers one-click sign-in once the site's OAuth application is registered, with an access token as the alternative. Editors choose whether to stay signed in on the device.
- **Publishing:** each Publish saves every changed file in one commit to the site's main branch. If someone else published changes to other files in the meantime, publishing still goes ahead; if they changed the same files, it stops instead of overwriting their work.
- **Live status:** after publishing, the top bar shows when the live site has been rebuilt, or that the rebuild failed, with a link to the details. This works with GitHub Pages, GitLab Pages and Vercel.
- **Unpublished changes:** leaving a screen with unpublished changes asks first.
- **Media:** upload images and files, by choosing them or dropping them onto the **Media** screen, and replace or delete them there. Deleting a file first lists everything that uses it. Wherever an image goes (an Image block, a section's background, the logo, a collection's image field) there's a **Choose image** button, which picks from the library or uploads a new one.
  - Large photos are made no bigger than 2400 pixels on their longest side, and JPEGs are re-saved, which removes details hidden in them such as where a photo was taken. SVG images have anything that could run code removed.
  - Images, PDFs, office documents, MP3 audio and MP4 video can be uploaded, up to 25 MB each. Web pages, scripts and other files that could run code can't.
  - New uploads show in the editor straight away, even before the live site has been rebuilt with them.
- **AI assistant:** the **AI** tab beside the editor writes with AI. Describe what you want: with nothing selected it adds new blocks to the end of the page, with a block selected it changes that block, and for a collection's item it fills in the fields. The result goes straight into the editor, so you can check it, change it or undo it before publishing. It's told never to make up facts such as times or names, and to leave `[placeholders]` instead.

### AI services

Each editor chooses an AI service in the AI tab's settings, and it's called straight from their browser. There's no server, so each editor uses their own account:

| Service | Needs | Cost |
|---|---|---|
| Claude (Opus 5.5, Sonnet 5.5 or Haiku 4.5) | An API key from the [Claude Console](https://platform.claude.com/settings/keys) | Charged per use, roughly a few cents for a page |
| OpenAI, Google Gemini, Groq, Mistral, OpenRouter | An API key from the service | Gemini, Groq, Mistral and OpenRouter have free tiers with limits |
| OVHcloud AI Endpoints | Nothing | Free, about 2 requests a minute |
| A chat app such as Claude.ai or ChatGPT | Copying the request in and the answer back | Whatever your chat app plan includes, including free plans |
| Any other OpenAI-compatible service | Its address, and a key if it needs one | Varies |

Keys stay in the editor's browser: for the session, or on the device if they choose, and they're forgotten on sign-out. They're only ever sent to the service they belong to. Free models write less reliably than Claude, so answers are always checked before they're used. A site can limit the services offered with `ai: { providers: ["anthropic", "manual"] }` in `goodfellow.config.tsx`, or remove the assistant with `ai: false`.

In development, Publish writes straight to the files in `content/`, with no sign-in.

### Built-in blocks

| Block | Purpose |
|---|---|
| Section | A full-width band of the page with a background, centering its content |
| Columns | Equal-width columns that stack on phones |
| Row | Blocks side by side, such as a group of buttons |
| Space | Empty vertical space |
| Heading | A heading, from page title (H1) down to H4 |
| Text | Formatted text: paragraphs, lists, links |
| Button | A link styled as a button |
| Image | An image with optional caption |
| Code | Code with syntax highlighting (done when the site is built), an optional title and a copy button |
| Menu | One of the site's menus, with dropdowns for submenus |
| Site name and logo | The site's logo and name, linking home |
| Search | A search box for the whole site, with results as visitors type |
| Collection navigation | Links to every item of a collection, grouped by a choice field, such as a docs site's sidebar |
| Contact details | The address, phone number and email address from Site settings, with the phone and email as links |
| Collection list | A collection's items as a list or cards, with options such as newest first, upcoming only and how many to show |
| Entry field | One of the item's fields, in a collection's page design only |
| Previous and next | Links to the items before and after this one, in a page design only |
| On this page | The headings of the item's Markdown text, linking to each, in a page design only |

In a collection's page design, any text can also show an item's field by naming it in braces: a Heading with `{title}`, a Button linking to `{video}`. The page's title and description work the same way.

Blocks use the site's theme colors, fonts and corner radius. Every block accepts extra CSS classes, which override the block's own styles: `py-4` on a Section replaces its default padding.

### Interactive blocks

A block can render Client Components: files that start with `"use client"`, where any React hooks and event handlers work.

```tsx
// blocks/like-button.tsx
"use client";

import { useState } from "react";

export function LikeButton({ label }: { label: string }) {
  const [likes, setLikes] = useState(0);
  return <button type="button" onClick={() => setLikes(likes + 1)}>{label} ({likes})</button>;
}
```

```tsx
// goodfellow.config.tsx
import { LikeButton } from "./blocks/like-button";

export default defineConfig({
  blocks: {
    ...blocks,
    Like: { fields: { label: { type: "text" } }, render: ({ label }) => <LikeButton label={label} /> },
  },
});
```

They run in the browser however the site is built. With `goodfellow build` and `goodfellow dev`, each one a block uses becomes an island: its HTML is in the page as usual, and the page loads React and that component's code to bring it to life. Pages without Client Components load no JavaScript. With Next.js, Next.js runs them.

- **Props** must be plain values: text, numbers, `true` and `false`, and lists and objects of these. A block can't pass a function, such as an `onClick` handler, so handlers go inside the Client Component.
- **Content** passed as `children` (or any prop holding JSX) is rendered by the block, and stays as it is in the browser. Client Components in it run on their own.
- **`useSite()`** works in Client Components, so pages with them include the site's settings, menus and collections for the browser. Use `SiteLink` and `SiteImage` for links and images, as in any block.
- **Packages:** Client Components from packages of blocks (packages that use `@goodfellow/react`) become islands like the site's own. To use another package's Client Component in a block, re-export it from a `"use client"` file of the site's: `"use client"; export { Carousel } from "some-carousel";`.

Each page with a Client Component loads React, so use HTML and CSS where they're enough: `<details>` for something that opens and closes, `:hover` and `:focus-within` for menus. Islands also have [limits](#nextjs) that Next.js doesn't, such as not sharing React context with each other.

### Blocks from block registries

The admin panel's **Blocks** screen adds more blocks to the editor, built with [shadcn/ui](https://ui.shadcn.com) and listed by kind, with the recommended ones marked:

| Block | What it's for |
|---|---|
| Hero | A large heading at the top of a page, with text, buttons and a picture |
| Cards | A grid of cards, each with a picture, a heading, text and a link |
| Call to action | A highlighted box asking visitors to do something, with a button |
| Testimonials | Quotes from people, with their names and photos |
| Notice | A short message that stands out, such as a closure or a change of times |
| Pricing table | Plans side by side, with prices, what each includes and a button |
| FAQ | Questions that open to show their answers |
| Tabs | Content split into tabs, one shown at a time |
| Image carousel | Pictures shown one at a time, with buttons to move between them |

Admins mark blocks to add and remove, then publish them together in one save, which writes their code into the site's repository, as a developer running `npx shadcn add` would: the block goes in `blocks/installed/`, and the shadcn components it uses in `components/ui/`. The editor offers it once the site has been rebuilt, a minute or two after publishing (at once with `goodfellow dev`). Like the built-in blocks, they use the site's colors, fonts and corner radius. FAQ, Tabs and Image carousel are [interactive](#interactive-blocks); the others need no JavaScript, and the FAQ's and Tabs' hidden content is still in the page for search engines.

Since the blocks' code is in the site, a developer can change it like any other code. Removing a block keeps files someone has changed.

Developers can publish registries of Goodfellow blocks built with other component libraries, in the format [described in `@goodfellow/registry`](packages/registry/README.md#publishing-your-own-registry). A site offers blocks only from Goodfellow's registry and the registries its `goodfellow.config.tsx` lists, since a block's code runs in the admin panel:

```tsx
registries: { "@acme": "https://acme.example/r/{name}.json" },
```

### Markdown collections

A collection can store its items as Markdown files: turn on **Store items as Markdown files** in its settings, and choose which formatted-text field is the text. Each item is then `content/collections/<id>/<slug>.md`, with the other fields as YAML front matter, which developers can edit and review like any text file. Changing the setting converts every item in the same publish.

The Markdown is GitHub-flavored, with tables. HTML in it is shown as text rather than run, links and images can only use addresses that can't run code, headings get ids for linking, and code blocks are highlighted when the site is built. Goodfellow's own docs are stored this way.

### Search

The Search block searches the whole site in the visitor's browser with [Pagefind](https://pagefind.app), so no search service is needed. Builds index a site only when one of its pages has a Search block, which marks itself with `data-goodfellow-search`; a third-party block can use the same index by doing the same. `goodfellow build` indexes the site itself, and Next.js sites run `goodfellow-next index out` after `next build`. Pages' main content is indexed, so headers, footers and "Page not found" are left out.

### Demo mode

To let anyone try the admin panel without signing in, for example from a product page or in a training session, set `demo: true` in `goodfellow.config.tsx`:

```tsx
export default defineConfig({ blocks, demo: true });
```

The site's `/admin` then opens straight away, with a banner saying it's a demo. Visitors can try everything editors can: pages, collections, the header and footer, the media library, site settings and the AI assistant (with their own key or a free service).

- **Nothing is published.** Publish saves the changes, uploads included, in the visitor's own browser, so they're still there after reloading. **Start over** in the banner undoes them all. The live site and the repository never change.
- **It starts from the site as last built.** `goodfellow build`, and `next build` for Next.js sites, put a copy of the content at `/admin/demo-content.json`. The repository can stay private, and `backend` is ignored.
- **Blocks** can be browsed but not added or removed, since adding one changes the site's code.
- **Only the config turns it on.** The admin panel never changes `goodfellow.config.tsx`, so editors can't turn a real site into a demo or back.
- **In development**, `goodfellow dev` and `next dev` start the demo from the files on disk, and changes stay in the browser there too. To edit the demo's own content in the admin panel, turn demo mode off while you do.

## Repository layout

This is a pnpm workspace managed with Turborepo.

| Path | Package | Purpose | Status |
|---|---|---|---|
| `packages/core` | `@goodfellow/core` | Config, content model, collections, migrations, the `GitBackend` interface and, later, Puck data diff and merge. No React or DOM. `@goodfellow/core/node` reads sites from disk and runs the local backend. | Started |
| `packages/github` | `@goodfellow/github` | GitHub backend and token sign-in | Started |
| `packages/gitlab` | `@goodfellow/gitlab` | GitLab backend, with OAuth (PKCE) and token sign-in | Started |
| `packages/react` | `@goodfellow/react` | Page renderer: layout, class names, theme and collection templates | Started |
| `packages/admin` | `@goodfellow/admin` | The `<Admin>` editor app | Started |
| `packages/ai` | `@goodfellow/ai` | The AI assistant's requests, answer checking and AI service clients. No React. | Started |
| `packages/blocks` | `@goodfellow/blocks` | Built-in, library-agnostic blocks | Started |
| `packages/cli` | `goodfellow` | `goodfellow dev`, `build` and `preview` | Started |
| `packages/next` | `@goodfellow/next` | Next.js adapter: pages as Server Components, static export, the admin panel | Started |
| `docs` | | Goodfellow's documentation site, built with Goodfellow | Started |
| `packages/registry` | `@goodfellow/registry` | Goodfellow's block registry: blocks built with shadcn/ui, and the format for other registries | Started |
| `packages/create-goodfellow` | `create-goodfellow` | Creates a new site from the starter or an example | Started |
| `templates/starter` | | The starter site copied by `create-goodfellow` | Started |
| `templates/next` | | The starter as a Next.js app | Started |
| `examples/parish` | | Example site for a made-up parish, with collections and custom blocks | Started |
| `e2e/` | | End-to-end tests of the admin panel, run against copies of the starter and the Next.js starter | Started |

### A Goodfellow site

```
my-site/
├── goodfellow.config.tsx    # blocks, git backend, repository
├── blocks/                  # the site's own custom blocks
│   └── installed/           # blocks added on the admin panel's Blocks screen
├── components/ui/           # shadcn components those blocks use
├── content/                 # everything the admin panel edits
│   ├── site.json            # title, favicon, metadata, theme colors, fonts
│   ├── menus.json           # navigation menus
│   ├── layout/header.json   # Puck data
│   ├── layout/footer.json
│   ├── pages/index.json     # one file per page, mirroring the URL
│   ├── collections/videos/
│   │   ├── _collection.json # fields, address pattern, template
│   │   └── easter-vigil.json # one item: its field values
│   └── styles/custom.css
├── public/media/            # uploaded images and files, served at /media/
├── src/styles.css           # imports Tailwind and the theme; scans content/ for classes
├── components.json          # shadcn settings, for developers adding blocks with the shadcn CLI
├── .github/workflows/deploy.yml
├── .gitlab-ci.yml
└── vercel.json
```

## Roadmap

1. **Static rendering** (done). Build a static site from hand-written `content/` files.
2. **Editor** (done). The admin panel against local files: pages, site settings, header and footer, custom CSS, live Tailwind preview.
3. **Git backends** (done). GitHub and GitLab sign-in, publishing, conflict detection and deploy status, plus GitHub Pages, GitLab Pages and Vercel setups.
4. **Collections and templates** (done). Collections with their own fields, a shared page design for their items, and a block that lists them on other pages.
5. **AI assistant** (done). Draft and rewrite pages with Claude, OpenAI or a free AI service, called straight from the editor's browser with the editor's own key. Editors without a key can copy a prompt into Claude.ai or another chat app and paste the answer back.
6. **Media library** (done). Upload, browse and replace images and files from the admin panel, and choose them for blocks and settings.
7. **Starters** (done). `create-goodfellow`, which creates a site and sets up its storage and host, and an example parish site with collections and custom blocks.
8. **Next.js adapter** (done). Goodfellow pages and the admin panel in a Next.js app, exported as static files, with a Next.js starter. Links use `next/link` and images `next/image`, sites can be served from a subfolder, and blocks can use Client Components.
9. **Interactive blocks everywhere** (done). Client Components in blocks (`"use client"`) run in the browser on sites built with `goodfellow build` too, not only with Next.js.
10. **shadcn blocks** (done). A registry of Goodfellow blocks built with [shadcn/ui](https://ui.shadcn.com), installed into the site without a developer. When creating a site, admins choose "Recommended" or "Built-in blocks only"; the admin panel lets them add and remove individual blocks. Others can publish registries of blocks built with other libraries, in a documented format. Updating installed blocks comes with step 16's automatic updates.
11. **Demo mode** (done). A site whose config sets `demo: true` (it can only be turned on in the config, never from the admin panel) opens its admin panel to anyone, with no sign-in. Visitors can try everything, from editing pages and collections to the media library, settings and the AI assistant, but nothing is published: their changes stay in their own browser until they start over. The demo starts from a copy of the site's content that the build includes, so the repository can stay private.
12. **Documentation site.** A documentation site built with Goodfellow itself, in `docs/`, and the blocks it needs, which any site can use: code with syntax highlighting, search (with [Pagefind](https://pagefind.app), indexed only on sites that use a search block), navigation within a collection, previous and next links, and an "On this page" list. Collections can store their items as Markdown files, edited in the admin panel's formatted editor or as Markdown. The docs cover why Goodfellow exists and how it compares with alternatives such as WordPress and TinaCMS, guides for site owners and editors, reference docs for developers, and each host's rules for business sites on its free plan. Built and tested, but not yet online.
13. **Going live.** Make the repository public, publish the packages to npm, and put the documentation site online with GitHub Pages. A demo site, made from the parish example in a repository of its own with the published packages, goes online with GitHub Pages too, and the docs link to it.
14. **Site setup without a developer.** A web page where anyone can create a site from a starter, store it on GitHub or GitLab, and put it online with GitHub Pages, GitLab Pages or Vercel. It asks what the site is for and recommends a host whose free plan allows it, such as GitLab Pages for a business. Builds work out which repository they're in, so nobody has to edit the config.
15. **Custom domains.** Connect a domain from the admin panel. Goodfellow sets the domain on the host where it can, lists the records to add at the domain's registrar, with guides for popular registrars, and shows when the domain is working.
16. **Running a site without a developer.**
    - Invite and remove editors from the admin panel.
    - Version history, with a way to restore an earlier version of a page.
    - Automatic updates: a scheduled job updates Goodfellow, and blocks added from block registries, and publishes the update only if the site still builds. Block updates replace only files nobody has changed.
    - Plain-language explanations when a rebuild fails.
    - Contact forms, through a form service the site owner can set up without a developer.
17. **Stock photos from the AI assistant.** When the media library has nothing that fits, the AI assistant can add free stock photos whose license allows it, such as from [Unsplash](https://unsplash.com), crediting the photographer as the license and the service require. A checkbox in the AI panel turns this on or off for each request and is remembered in the browser; a site's config can turn it off for everyone.

## Contributing

See [AGENTS.md](AGENTS.md) for architecture rules and conventions. They apply to human contributors as well as coding agents.

## License

[MIT](LICENSE)

## Acknowledgements

Goodfellow is built on [Puck](https://github.com/puckeditor/puck) and is not affiliated with Puck or its maintainers. The name comes from Robin Goodfellow, the other name of Puck in *A Midsummer Night's Dream*. Sign-in and backend design draw on [Sveltia CMS](https://github.com/sveltia/sveltia-cms) and [Decap CMS](https://decapcms.org).
