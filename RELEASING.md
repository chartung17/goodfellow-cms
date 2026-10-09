# Releasing

Goodfellow's packages are released together, with one version number: every package in `packages/` is in one `fixed` group in `.changeset/config.json`, so a release publishes all of them, changed or not. The changes since the last release are the changesets in `.changeset/`.

## Every release

1. On an up-to-date `master`, make a branch and turn the changesets into changelogs and versions:

   ```sh
   git switch master && git pull
   git switch -c release
   pnpm release:version
   ```

   This runs `changeset version`, which bumps every package to the new version, adds the changesets to each package's `CHANGELOG.md` and deletes them. Read the changelogs, then commit (for example "Release 0.2.0"), push and open a pull request.

2. Merge it once CI passes. When CI then passes on `master`, the **Release** workflow (`.github/workflows/release.yml`):
   - publishes every package npm doesn't have at the new version, with provenance;
   - tags the release: `v0.2.0`, and `<package>@0.2.0` for each package, as Changesets would;
   - deploys the docs site from the same commit (`.github/workflows/docs.yml`), so the docs describe the version on npm.

   Other changes to `master` don't change the versions, so the workflow finds nothing to publish and stops.

If the workflow fails partway, re-run it from the Actions tab: versions already on npm are skipped.

## Publishing from your computer

`pnpm release:publish` does the same as the workflow from your computer: it checks that you're on GitHub's latest `master` with nothing uncommitted and signed in to npm (`npm login`), runs lint, typecheck, tests and the build, shows what it will publish and asks before publishing. npm asks for a one-time code or a browser sign-in itself if your account needs one. `pnpm release:publish --dry-run` shows what would happen without publishing or tagging.

Afterwards, run **Deploy docs** in the Actions tab to update the docs site.

## The docs between releases

The docs site changes only with a release. To publish a fix to the docs sooner, run **Deploy docs** in the Actions tab with `master` as the version; leave the version empty to rebuild the latest release.

## Setting up (once)

1. **npm:** create the free organization `goodfellow` at <https://www.npmjs.com/org/create>, so the `@goodfellow` packages can be published. `goodfellow` and `create-goodfellow` aren't in the organization, but whoever publishes them first owns them.
2. **How the Release workflow signs in to npm.** Either:
   - **A token:** on npmjs.com, create a granular access token with read and write access to all packages and to the `goodfellow` organization, allowed to publish without two-factor codes. Add it to the repository as the secret `NPM_TOKEN` (Settings → Secrets and variables → Actions). It works from the first release, but it's a long-lived secret that has to be renewed when it expires.
   - **Trusted publishing**, with no secret: npm sets it up in each package's settings, so each package has to exist first. Make the first release from your computer (merge the version pull request as usual: the workflow will fail at publishing, then run `pnpm release:publish`). Then, shortly before the next release, open each of the 11 packages' settings on npmjs.com and add a trusted publisher: GitHub Actions, owner `chartung17`, repository `goodfellow-cms`, workflow `release.yml`. npm drops a trusted publisher that hasn't published within 2 days of being added. Once it works, npm recommends "Require two-factor authentication and disallow tokens" under each package's Settings → Publishing access.
3. **Make the repository public** (Settings → General → Danger Zone). GitHub Pages and npm's provenance need it to be.
4. **GitHub Pages:** in Settings → Pages, set **Source** to **GitHub Actions**. The docs are then at <https://chartung17.github.io/goodfellow-cms/>.
5. **The demo site** lives in a repository of its own, `chartung17/goodfellow-demo`, made from the parish example with the published packages; the docs' [Demo mode](docs/content/collections/docs/demo-mode.md) page has the steps. The docs and README link to <https://chartung17.github.io/goodfellow-demo/admin/>, so use that name, or change the links.
