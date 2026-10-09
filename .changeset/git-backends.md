---
"@goodfellow-cms/core": minor
"@goodfellow-cms/admin": minor
"@goodfellow-cms/github": minor
"@goodfellow-cms/gitlab": minor
"goodfellow": minor
---

Publishing to GitHub and GitLab. New `@goodfellow-cms/github` and `@goodfellow-cms/gitlab` backends edit a site's repository straight from the browser: GitHub with an access token from a prefilled link, GitLab with one-click OAuth (PKCE) or a token. Set `backend` in `goodfellow.config.tsx` and `goodfellow build` includes the admin panel at `/admin/`, with a sign-in screen, an account menu and a live-site status that follows the deploy after each publish. `@goodfellow-cms/core` adds the `GitHost` and `GitBackend` interfaces, `writeChanges()` (which saves over other people's changes to other files but never the same ones), and `@goodfellow-cms/core/testing` with an in-memory repository for fakes. `goodfellow dev` gives each site its own Vite cache and keeps watching content when folders are replaced.
