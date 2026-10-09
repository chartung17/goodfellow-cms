---
"create-goodfellow": patch
---

`create-goodfellow` runs `npm install`, then makes the new site a git repository on the branch `main`, which the deploy setups build from, with everything, `package-lock.json` included, in its first commit, and `origin` set when it's given the site's GitHub repository or GitLab project. If git doesn't know your name and email yet, it says how to tell it and commit. `--no-install` and `--no-git` leave these out, and no repository is made inside another git repository or without git installed.
