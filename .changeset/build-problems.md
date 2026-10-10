---
"@goodfellow-cms/core": minor
"@goodfellow-cms/github": minor
"@goodfellow-cms/gitlab": minor
"@goodfellow-cms/admin": minor
"goodfellow": minor
---

Plain-language explanations of failed rebuilds: the top bar's **What went wrong?** says whether the host didn't start the build, packages couldn't be installed, Pages isn't set up, a content file has a problem (linking to its version history), or the site's code couldn't be built, with the host's details behind a toggle. `goodfellow build` prints what went wrong for the admin panel, and an annotation on GitHub Actions. The GitHub backend now reads the deploy workflow's run, so a build that fails before deploying is reported as failed rather than building; the sign-in token link asks for Actions: read. The owner token now lasts a day, the shortest GitHub allows, instead of a week.
