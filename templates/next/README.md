# My site

A website built with [Goodfellow](https://github.com/chartung17/goodfellow-cms) and [Next.js](https://nextjs.org). Pages are files in `content/`, edited in the admin panel at `/admin`, and built into static files that a free host serves.

## Working on the site

```sh
npm install
npm run dev      # site at http://localhost:4321, admin panel at http://localhost:4321/admin
npm run build    # builds the site into out/
```

On your own computer, the admin panel saves straight to the files in `content/`. To see the built site as a host would serve it, serve `out/` with any static server, such as `npx serve out`.

The News page and its stories are an example of a collection: a group of similar items that share one page design. Change it or delete it under **Collections** in the admin panel.

## How it fits together

| File | What it does |
|---|---|
| `goodfellow.config.tsx` | The site's blocks and where it's stored, shared by its pages and the admin panel |
| `app/[[...path]]/page.tsx` | Every page in `content/`. Pages are Server Components with the same HTML as `goodfellow build`, and blocks send no JavaScript. |
| `app/not-found.tsx` | The site's "Page not found" page, `content/pages/404.json` |
| `app/admin/page.tsx` | The admin panel |
| `app/site.css` | The site's styles: Tailwind, the theme, and the custom CSS from the admin panel |
| `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts` | The page around everything, and files for search engines |
| `next.config.ts` | `withGoodfellow()` builds static files, and runs the admin panel's local backend in `next dev` |

Your own Next.js pages can go beside these, in `app/`. Blocks are shared with sites built without Next.js, so they can't use Next.js features or React hooks such as `useState`. Read the site's settings, menus and collections with `useSite()`.

## Putting the site online

Setup takes four steps. It's done once, usually by whoever set up the site.

### 1. Store the site on GitHub or GitLab

Create a repository and push this folder to it, including `package-lock.json`.

### 2. Tell Goodfellow where the site is stored

If you gave the repository when creating the site with `npm create goodfellow`, this is already done. Otherwise, in `goodfellow.config.tsx`, uncomment one `backend` line and its `import`, and fill in your repository:

```tsx
import { github } from "@goodfellow/github";

export default defineConfig({
  blocks,
  categories,
  backend: github({ repo: "your-name/your-site" }),
});
```

Until a backend is set, the admin panel on the live site only says it isn't set up yet. If the live site is built from a branch other than the repository's default branch, add `branch: "name"`.

Also set the site's address under **Site settings → General → Site address**, such as `https://your-name.github.io`. It's used for the sitemap and for link previews.

### 3. Choose a host

This site must be served from the root of its address (`https://example.org/`, not `https://example.org/my-site/`), because links in its pages don't yet follow Next.js's `basePath`. The deploy setups stop with an explanation if the host would serve it from a subfolder.

Each host's free plan has its own rules about business use. If the site is for a business, sells anything, shows ads, or is built or looked after by someone who's paid for it, check those rules first. As of October 2026, GitHub Pages and Vercel's free plan don't allow most of these, and GitLab Pages has no rule against them that we know of. See [Commercial sites](https://github.com/chartung17/goodfellow-cms#requirements-and-limits) in Goodfellow's README.

**GitHub Pages** (free for public repositories; not for online businesses or shops)

1. Use a repository named `your-name.github.io`, or set up a custom domain: other repositories are served from a subfolder.
2. In the repository on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push. `.github/workflows/deploy.yml` builds and publishes the site on every change and once a night. If your main branch isn't called `main`, change it in that file.

**GitLab Pages** (free, including for private projects; no rule against business sites that we know of)

1. Under **Deploy → Pages**, turn on **Use unique domain** (the default for new projects), so the site isn't served from a subfolder.
2. Push. `.gitlab-ci.yml` builds and publishes the site on every change to the default branch.
3. For nightly rebuilds, add a schedule under **Build → Pipeline schedules**.
4. The site's address is under **Deploy → Pages**.

**Vercel** (works with GitHub and GitLab; the free plan is for non-commercial sites only)

1. Import the repository in Vercel, which recognizes it as a Next.js site.
2. For nightly rebuilds, create a deploy hook under **Settings → Git → Deploy Hooks**, and call it from a scheduled GitHub Action or GitLab pipeline schedule.

Delete the setup files for the hosts you don't use.

### 4. Set up sign-in

**GitHub:** nothing to set up. Editors sign in at `/admin` with an access token. The admin panel links to GitHub's token page with the right permissions already chosen. On that page, under **Repository access**, choose **Only select repositories** and pick the site.

- Editors who are collaborators on someone else's personal repository can't use that kind of token. They can use the "broader token" link instead. Alternatively, move the repository into a free GitHub organization and make editors members.

**GitLab:** editors can sign in with an access token straight away. For one-click **Sign in with GitLab**, register the admin panel with GitLab once:

1. Go to your profile's **Preferences → Applications** (or the group's **Settings → Applications**) and add an application.
2. Set:
   - **Redirect URI:** the admin panel's address with a trailing slash, such as `https://your-site.example/admin/`.
   - **Confidential:** leave this **off**.
   - **Scopes:** `api`.
3. Copy the **Application ID** into the config: `gitlab({ project: "your-name/your-site", clientId: "…" })`.

Every editor needs permission to change the repository: on GitHub, write access; on GitLab, the Developer role or higher.

## Images and files

Upload images and files on the admin panel's **Media** screen, or with the **Choose image** button wherever an image goes. They're saved in `public/media/`, and large photos are made web-sized automatically.

## Writing with AI

The admin panel's **AI** tab can draft pages, rewrite blocks and fill in news stories. Each editor picks an AI service there. Claude and some others need the editor's own API key and charge for use; there are free options, including copying the request into a chat app such as Claude.ai. To offer only some services, or to turn the assistant off, see `ai` in [Goodfellow's README](https://github.com/chartung17/goodfellow-cms#ai-services).

## Publishing

Each **Publish** in the admin panel saves its changes as one commit to the main branch, which starts a new build. The admin panel shows when the live site has been updated, usually within a minute or two. If someone else changed the same page in the meantime, publishing stops and explains what happened, instead of overwriting their work.
