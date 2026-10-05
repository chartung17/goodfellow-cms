# Goodfellow

A git-based website builder built on the [Puck](https://puckeditor.com) visual editor.

Goodfellow gives non-technical site owners a drag-and-drop editor at `/admin` with no server, database or monthly hosting bill. Pages are stored as files in the site's own GitHub or GitLab repository. Every save is a commit, and a free static host (GitHub Pages, GitLab Pages or Vercel) rebuilds the site.

> **Status: early development.** Static rendering works: a site's content files build into a static website. There is no admin panel yet, so content is edited by hand. This README describes what Goodfellow is meant to become; the [roadmap](#roadmap) shows what exists.

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
- **Class names and custom CSS.** Any block can take Tailwind classes, and admins can write site-wide CSS. Classes appear in the editor preview immediately, before the site is rebuilt.
- **Custom blocks** for developers: any React component can become a block.
- **Sign-in without a server:**
  - **GitHub:** a "Sign in" button opens GitHub's token page with the right permissions already filled in.
  - **GitLab:** one-click OAuth sign-in (PKCE), after the site owner registers an OAuth application once.
- **Deploy setups** for GitHub Pages, GitLab Pages and Vercel, including a nightly rebuild for time-based content.
- **Works with or without a framework.** A standalone command-line tool builds the site with no framework at all, and a Next.js adapter is planned.

Planned for later: [Puck AI](https://puckeditor.com/docs/ai/getting-started), OAuth sign-in for GitHub via a small Cloudflare Worker, more component libraries (shadcn first), review workflows (pull/merge requests from the admin panel), per-user permissions, import/export, plugins and themes, and Bitbucket support.

## Requirements and limits

Goodfellow runs entirely on free tiers, but those tiers have limits worth knowing about:

| | GitHub Free | GitLab Free |
|---|---|---|
| Free static hosting | GitHub Pages, **public repos only** | GitLab Pages, public or private |
| Editors | Unlimited collaborators | Up to 5 users in a private group or account; unlimited if public |
| Build minutes | Unlimited for public repos, 2,000/month for private | 400/month (or build on Vercel instead) |
| Sign-in | Personal access token (fine-grained, or classic for collaborators) | OAuth (PKCE) or personal access token |

**GitHub sign-in:** GitHub doesn't let collaborators on someone else's repository use fine-grained tokens. For sites with several editors, put the repository in a free GitHub organization and add editors as members; otherwise collaborators need a classic token.

## Getting started

Eventually, `npm create goodfellow@latest my-site` will create a new site. Until then, try the starter site in this repository (Node 22 or later and pnpm required):

```sh
pnpm install
pnpm build
cd templates/starter
pnpm dev        # http://localhost:4321, re-renders as you edit content/
pnpm build      # writes the static site to dist/
pnpm preview    # serves dist/ the way a static host would
```

### Commands

| Command | What it does |
|---|---|
| `goodfellow dev` | Serves the site, rendering each page from the files on disk, and reloads the browser when content changes |
| `goodfellow build` | Writes one HTML file per page to `dist/`, builds the CSS and copies `public/`. Also writes `sitemap.xml` and `robots.txt` if the site's address is set. |
| `goodfellow preview` | Serves `dist/`, including the 404 page |

Options: `--root <dir>`, `--out <dir>`, `--port <port>`, and `--base <path>` for sites served from a subfolder, such as `/my-repo/` on GitHub Pages.

The base path comes from `--base`, then the `GOODFELLOW_BASE` environment variable, then `base` in `goodfellow.config.tsx`. Every root-relative link and image in the built pages is adjusted to match, including links inside rich text. The site's address (`url` in `content/site.json`) should be the full public address, subfolder included.

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

Blocks use the site's theme colors, fonts and corner radius. Every block accepts extra CSS classes, which override the block's own styles: `py-4` on a Section replaces its default padding.

## Repository layout

This is a pnpm workspace managed with Turborepo.

| Path | Package | Purpose | Status |
|---|---|---|---|
| `packages/core` | `@goodfellow/core` | Config, content model, migrations and, later, collections, Puck data diff and merge, and the `GitBackend` interface. No React or DOM. | Started |
| `packages/github` | `@goodfellow/github` | GitHub backend and token sign-in | Planned |
| `packages/gitlab` | `@goodfellow/gitlab` | GitLab backend and PKCE sign-in | Planned |
| `packages/react` | `@goodfellow/react` | Page renderer: layout, class names, theme and, later, template bindings | Started |
| `packages/admin` | `@goodfellow/admin` | The `<Admin>` editor app | Planned |
| `packages/blocks` | `@goodfellow/blocks` | Built-in, library-agnostic blocks | Started |
| `packages/cli` | `goodfellow` | `goodfellow dev`, `build` and `preview` | Started |
| `packages/next` | `@goodfellow/next` | Next.js adapter | Planned |
| `packages/create-goodfellow` | `create-goodfellow` | Project scaffolder | Planned |
| `templates/starter` | | The starter site copied by `create-goodfellow` | Started |
| `examples/parish` | | Example site with collections and custom blocks | Planned |
| `e2e/` | | End-to-end tests against mocked git APIs | Planned |

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
│   │   ├── _collection.json # fields, URL pattern, template
│   │   └── my-video.json    # one entry
│   └── styles/custom.css
├── public/media/            # uploaded files
├── src/styles.css           # imports Tailwind and the theme; scans content/ for classes
├── .github/workflows/deploy.yml
├── .gitlab-ci.yml
└── vercel.json
```

## Roadmap

1. **Static rendering** (done). Build a static site from hand-written `content/` files.
2. **Editor.** The admin panel against local files: pages, site settings, header and footer, custom CSS, live Tailwind preview.
3. **Git backends.** GitHub and GitLab sign-in, publishing, conflict detection and deploy status, plus GitHub Pages, GitLab Pages and Vercel setups.
4. **Collections and templates.**
5. **Starters.** `create-goodfellow` and the parish example.
6. **Next.js adapter.**

## Contributing

See [AGENTS.md](AGENTS.md) for architecture rules and conventions. They apply to human contributors as well as coding agents.

## License

[MIT](LICENSE)

## Acknowledgements

Goodfellow is built on [Puck](https://github.com/puckeditor/puck) and is not affiliated with Puck or its maintainers. The name comes from Robin Goodfellow, the other name of Puck in *A Midsummer Night's Dream*. Sign-in and backend design draw on [Sveltia CMS](https://github.com/sveltia/sveltia-cms) and [Decap CMS](https://decapcms.org).
