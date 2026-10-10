---
version: 1
title: Keeping a site up to date
description: How sites install Goodfellow's fixes each night, and how owners choose newer releases.
section: owners
order: 5
---

Goodfellow gets fixes and new releases. Sites made from a starter install fixes on their own each night, and only once they've checked that the site still builds with them. **Site settings → Updates** in the admin panel shows the site's release, what it can update to, and how the last update went.

## How updates work

Each night, the site's build on GitHub Pages or GitLab Pages first runs `goodfellow update`:

1. It finds the newest fix for the site's release on npm: for a site on 0.4.1, the newest 0.4 release. Releases that can change how things work, such as 0.5, are only installed when an owner chooses one.
2. It updates every Goodfellow package to it, and the version of Puck that release uses.
3. It updates blocks added from Goodfellow's block registry. A block's files that someone changed since they were added stay as they are, and the Updates screen lists them, so nobody's changes are lost.
4. It installs the packages and builds the site. If either fails, every file goes back as it was, and the site is built as it was before.
5. If the site built, the update is published as one change, named "Update Goodfellow to …", which the site's version history shows.

The rest of the build then puts the site online as usual, with the update if it worked.

## The Updates screen

- **Fixes:** when fixes are ready, **Install fixes now** installs them without waiting for the night.
- **Newer releases:** when a newer release is out, owners see **Update to …**, with a link to what's new. Read it first: a newer release can change how some things work.
- **Last update:** when the last update ran and what it did. If it didn't work, it says why: for example, the site didn't build with it, in which case a developer may need to look at the details.

On GitHub, installing an update from the screen runs the site's workflow, which needs the [owner token](/docs/sign-in#inviting-and-removing-editors) the screen asks for. It can also run workflows.

## Turning it on

- **GitHub Pages:** the starter's workflow, `.github/workflows/deploy.yml`, updates the site each night already.
- **GitLab Pages:** GitLab needs two things first, which **Turn on automatic updates** on the Updates screen does: letting the site's build publish (**Allow Git push requests to the repository**, under **Settings → CI/CD → Job token permissions**, which GitLab offers from release 18.4), and a pipeline schedule that runs the build each night. It needs the Maintainer role in the site's project.
- **Older sites, and sites on Vercel:** their build setup doesn't update Goodfellow, so the Updates screen says so. A developer can copy the `update` job from the starter's `deploy.yml`, or the update step from its `.gitlab-ci.yml`, or run `npx goodfellow update` and publish the result.

## For developers

`goodfellow update` (or `goodfellow-next update` in a Next.js site) updates the site in its folder:

- `--to fixes`, the default, installs the newest fix for the site's release; `--to latest` the newest release; `--to 0.5.0` a release itself.
- `--publish` commits and pushes the update to the site's main branch once the site has built with it. Without it, the files are left changed for you to look at.
- It prints a line starting `goodfellow-update`, which the admin panel reads in GitLab's log, and exits with an error when the update didn't work.
