---
"@goodfellow-cms/core": minor
"@goodfellow-cms/github": minor
"@goodfellow-cms/gitlab": minor
---

`githubSetup()` and `gitlabSetup()` create a site's repository from the browser, for the documentation site's setup page: they list the accounts and groups the person can create it in, create it on the branch `main` with every file in one first commit, and turn on GitHub Pages (or make a private project's GitLab Pages public). On GitHub they also add a rule that stops the main branch's history being rewritten or deleted, where the plan allows it. GitLab sign-in can be by redirect, with PKCE. The fakes in `@goodfellow-cms/github/testing` and `@goodfellow-cms/gitlab/testing` can create repositories too.
