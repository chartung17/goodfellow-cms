# Goodfellow

A git-based website builder built on the [Puck](https://puckeditor.com) visual editor.

Goodfellow gives non-technical site owners a drag-and-drop editor at `/admin` with no server, database or monthly hosting bill. Pages are stored as files in the site's own GitHub or GitLab repository. Every save is a commit, and a free static host (GitHub Pages, GitLab Pages or Vercel) rebuilds the site.

> **Status: early development.** Static rendering, the admin panel, collections, the AI assistant, the media library, publishing to GitHub or GitLab, `create-goodfellow` and the Next.js adapter work, with deploy setups for GitHub Pages, GitLab Pages and Vercel. Nothing is published to npm yet. This README describes what Goodfellow is meant to become; the [roadmap](#roadmap) shows what exists.

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
- **Collections and templates.** Build a layout once (for example `/videos/{slug}`), then add entries by filling in a simple form.
- **AI assistant.** Describe what you want and AI writes it into the page, rewrites a block, or fills in an item's fields. Editors choose the AI service: Claude, OpenAI, a free service, or any chat app by copy and paste.
- **Class names and custom CSS.** Any block can take Tailwind classes, and admins can write site-wide CSS. Classes appear in the editor preview immediately, before the site is rebuilt.
- **Custom blocks** for developers: any React component can become a block.
- **Sign-in without a server:**
  - **GitHub:** a "Sign in" button opens GitHub's token page with the right permissions already filled in.
  - **GitLab:** one-click OAuth sign-in (PKCE), after the site owner registers an OAuth application once.
- **Deploy setups** for GitHub Pages, GitLab Pages and Vercel, including a nightly rebuild for time-based content.
- **Works with or without a framework.** A standalone command-line tool builds the site with no framework at all, or the site can be part of a Next.js app.

Planned for later: OAuth sign-in for GitHub via a small Cloudflare Worker, a Claude connector for editing the site from a chat, more component libraries (shadcn first), review workflows (pull/merge requests from the admin panel), per-user permissions, import/export, plugins and themes, and Bitbucket support.

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

It asks which site to start from, where the site will be stored (GitHub or GitLab) and where it will be hosted, with each host's rules for business sites, and sets the site up to match. Three sites are available:

- **Starter** (`templates/starter`): a home page, an about page and a news section.
- **Parish example** (`examples/parish`): a made-up parish with Mass times, events, news, bulletins and staff, and blocks of its own. It shows what a complete site looks like and how a developer adds blocks.
- **Starter for Next.js** (`templates/next`): the starter as a Next.js app, for developers who want their own Next.js pages beside the site's. See [Next.js](#nextjs).

To skip the questions, give the answers as options: `npm create goodfellow@latest my-site -- --template parish --github your-name/your-site --host github-pages`. Run it with `--help` for the full list.

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
- `goodfellowPages(config)` gives the routes their parts: `Page`, `generateStaticParams` and `generateMetadata` for `app/[[...path]]/page.tsx`, `NotFound` for `app/not-found.tsx`, and `sitemap` and `robots`.
- `<GoodfellowAdmin config={config} />` from `@goodfellow/next/admin` is the admin panel, in a Client Component at `app/admin/page.tsx`.
- Pages render as Server Components. Blocks' links to the site's pages use `next/link`, so moving between pages doesn't reload, and the site's images use `next/image` with their sizes filled in. Images are served as they are unless the site sets a [custom image loader](https://nextjs.org/docs/app/api-reference/components/image#loader), since a static export can't resize them on request.
- Blocks can render Client Components (`"use client"`) with any React hooks, and they run in the browser. They can read the site with `useSite()`.

**Compared with `goodfellow build`:** Next.js suits developers who want interactive components, client-side navigation, their own Next.js pages beside the site's, or Next.js's ecosystem. It costs more: each page loads Next.js's JavaScript and carries its own content again as data (plus the site's data when it has Client Components), builds take longer, and there are more dependencies to keep up to date. Most of Next.js's server features don't apply, because Goodfellow sites are static. For a content site, `goodfellow build` is lighter and simpler.

### Commands

| Command | What it does |
|---|---|
| `goodfellow dev` | Serves the site, rendering each page from the files on disk and reloading it when content changes, plus the admin panel at `/admin`, which saves to those files |
| `goodfellow build` | Writes one HTML file per page to `dist/`, builds the CSS and copies `public/`. Also writes `sitemap.xml` and `robots.txt` if the site's address is set, and the admin panel at `/admin/` if the config has a `backend`. |
| `goodfellow preview` | Serves `dist/`, including the 404 page |

Options: `--root <dir>`, `--out <dir>`, `--port <port>`, and `--base <path>` for sites served from a subfolder, such as `/my-repo/` on GitHub Pages.

The base path comes from `--base`, then the `GOODFELLOW_BASE` environment variable, then `base` in `goodfellow.config.tsx`. Every root-relative link and image in the built pages is adjusted to match, including links inside rich text. The site's address (`url` in `content/site.json`) should be the full public address, subfolder included.

### The admin panel

The admin panel is at `/admin` on the live site, and while `goodfellow dev` is running. Everything there is written for people who have never used git.

- **Pages:** create pages, edit them in Puck, change a page's address (updating menu links to it), and delete pages. The editor shows the site's header and footer around the page, styled exactly like the live site.
- **Collections:** groups of similar items, such as videos, events or staff. Create a collection, choose its fields (short or long text, formatted text, numbers, dates, links, images and choices from a list), and design the page every item shares in Puck. Then add items by filling in their fields, with a live preview of the item's page. A link field can point to an uploaded file, such as a PDF. Removing a field removes it from every item in the same publish.
- **Header & footer:** edit them in Puck, like pages.
- **Site settings:** the site's name, address, logo and icons; contact details; colors, fonts and corner rounding; menus; and custom CSS. A preview of the home page shows changes as you type.
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
| Menu | One of the site's menus, with dropdowns for submenus |
| Site name and logo | The site's logo and name, linking home |
| Contact details | The address, phone number and email address from Site settings, with the phone and email as links |
| Collection list | A collection's items as a list or cards, with options such as newest first, upcoming only and how many to show |
| Entry field | One of the item's fields, in a collection's page design only |

In a collection's page design, any text can also show an item's field by naming it in braces: a Heading with `{title}`, a Button linking to `{video}`. The page's title and description work the same way.

Blocks use the site's theme colors, fonts and corner radius. Every block accepts extra CSS classes, which override the block's own styles: `py-4` on a Section replaces its default padding.

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
9. **Interactive blocks everywhere.** Client Components in blocks (`"use client"`) run in the browser on sites built with `goodfellow build` too, not only with Next.js, while pages without them still load no JavaScript.
10. **Documentation site.** Guides for site owners and editors, plus reference docs for developers. Includes each host's rules for commercial sites on its free plan, kept up to date.
11. **Site setup without a developer.** A web page where anyone can create a site from a starter, store it on GitHub or GitLab, and put it online with GitHub Pages, GitLab Pages or Vercel. It asks what the site is for and recommends a host whose free plan allows it, such as GitLab Pages for a business. Builds work out which repository they're in, so nobody has to edit the config.
12. **Custom domains.** Connect a domain from the admin panel. Goodfellow sets the domain on the host where it can, lists the records to add at the domain's registrar, with guides for popular registrars, and shows when the domain is working.
13. **Running a site without a developer.**
    - Invite and remove editors from the admin panel.
    - Version history, with a way to restore an earlier version of a page.
    - Automatic updates: a scheduled job updates Goodfellow and publishes the update only if the site still builds.
    - Plain-language explanations when a rebuild fails.
    - Contact forms, through a form service the site owner can set up without a developer.

## Contributing

See [AGENTS.md](AGENTS.md) for architecture rules and conventions. They apply to human contributors as well as coding agents.

## License

[MIT](LICENSE)

## Acknowledgements

Goodfellow is built on [Puck](https://github.com/puckeditor/puck) and is not affiliated with Puck or its maintainers. The name comes from Robin Goodfellow, the other name of Puck in *A Midsummer Night's Dream*. Sign-in and backend design draw on [Sveltia CMS](https://github.com/sveltia/sveltia-cms) and [Decap CMS](https://decapcms.org).
