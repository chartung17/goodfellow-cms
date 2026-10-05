# Goodfellow

A git-based website builder built on the [Puck](https://puckeditor.com) visual editor.

Goodfellow gives non-technical site owners a drag-and-drop editor at `/admin` with no server, database or monthly hosting bill. Pages are stored as files in the site's own GitHub or GitLab repository. Every save is a commit, and a free static host (GitHub Pages, GitLab Pages or Vercel) rebuilds the site.

> **Status: early development.** Static rendering, the admin panel and publishing to GitHub or GitLab work, with deploy setups for GitHub Pages, GitLab Pages and Vercel. Nothing is published to npm yet. This README describes what Goodfellow is meant to become; the [roadmap](#roadmap) shows what exists.

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

Planned for later: OAuth sign-in for GitHub via a small Cloudflare Worker, a Claude connector for editing the site from a chat, more component libraries (shadcn first), review workflows (pull/merge requests from the admin panel), per-user permissions, import/export, plugins and themes, and Bitbucket support.

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
pnpm dev        # site at http://localhost:4321, admin panel at http://localhost:4321/admin
pnpm build      # writes the static site to dist/
pnpm preview    # serves dist/ the way a static host would
```

To put a site online, follow [the starter's README](templates/starter/README.md): it covers storing the site on GitHub or GitLab, choosing a host, and setting up sign-in.

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
- **Header & footer:** edit them in Puck, like pages.
- **Site settings:** the site's name, address, logo and icons; colors, fonts and corner rounding; menus; and custom CSS. A preview of the home page shows changes as you type.
- **Live styling:** CSS classes typed into a block, and custom CSS (including Tailwind's `@apply`), take effect in the editor immediately, before the site is rebuilt.
- **Signing in:** on the live site, editors sign in with GitHub or GitLab. GitHub uses an access token, created from a link that fills in the right permissions. GitLab offers one-click sign-in once the site's OAuth application is registered, with an access token as the alternative. Editors choose whether to stay signed in on the device.
- **Publishing:** each Publish saves every changed file in one commit to the site's main branch. If someone else published changes to other files in the meantime, publishing still goes ahead; if they changed the same files, it stops instead of overwriting their work.
- **Live status:** after publishing, the top bar shows when the live site has been rebuilt, or that the rebuild failed, with a link to the details. This works with GitHub Pages, GitLab Pages and Vercel.
- **Unpublished changes:** leaving a screen with unpublished changes asks first.

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

Blocks use the site's theme colors, fonts and corner radius. Every block accepts extra CSS classes, which override the block's own styles: `py-4` on a Section replaces its default padding.

## Repository layout

This is a pnpm workspace managed with Turborepo.

| Path | Package | Purpose | Status |
|---|---|---|---|
| `packages/core` | `@goodfellow/core` | Config, content model, migrations and, later, collections, Puck data diff and merge, and the `GitBackend` interface. No React or DOM. | Started |
| `packages/github` | `@goodfellow/github` | GitHub backend and token sign-in | Started |
| `packages/gitlab` | `@goodfellow/gitlab` | GitLab backend, with OAuth (PKCE) and token sign-in | Started |
| `packages/react` | `@goodfellow/react` | Page renderer: layout, class names, theme and, later, template bindings | Started |
| `packages/admin` | `@goodfellow/admin` | The `<Admin>` editor app | Started |
| `packages/blocks` | `@goodfellow/blocks` | Built-in, library-agnostic blocks | Started |
| `packages/cli` | `goodfellow` | `goodfellow dev`, `build` and `preview` | Started |
| `packages/next` | `@goodfellow/next` | Next.js adapter | Planned |
| `packages/create-goodfellow` | `create-goodfellow` | Project scaffolder | Planned |
| `templates/starter` | | The starter site copied by `create-goodfellow` | Started |
| `examples/parish` | | Example site with collections and custom blocks | Planned |
| `e2e/` | | End-to-end tests of the admin panel, run against a copy of the starter site | Started |

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
2. **Editor** (done). The admin panel against local files: pages, site settings, header and footer, custom CSS, live Tailwind preview.
3. **Git backends** (done). GitHub and GitLab sign-in, publishing, conflict detection and deploy status, plus GitHub Pages, GitLab Pages and Vercel setups.
4. **Collections and templates.**
5. **AI assistant.** Draft and rewrite pages with Claude, OpenAI or a free AI service, called straight from the editor's browser with the editor's own key. Editors without a key can copy a prompt into Claude.ai or another chat app and paste the answer back.
6. **Media library.** Upload, browse and replace images and files from the admin panel.
7. **Starters.** `create-goodfellow` and the parish example.
8. **Next.js adapter.**
9. **Documentation site.** Guides for site owners and editors, plus reference docs for developers.
10. **Site setup without a developer.** A web page where anyone can create a site from a starter, store it on GitHub or GitLab, and put it online with GitHub Pages, GitLab Pages or Vercel. Builds work out which repository they're in, so nobody has to edit the config.
11. **Custom domains.** Connect a domain from the admin panel. Goodfellow sets the domain on the host where it can, lists the records to add at the domain's registrar, with guides for popular registrars, and shows when the domain is working.
12. **Running a site without a developer.**
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
