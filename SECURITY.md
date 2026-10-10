# Security policy

Goodfellow's admin panel runs with editors' GitHub or GitLab tokens and AI keys, so security problems matter even though sites are static files.

## Reporting a problem

Please don't open a public issue. Report it privately instead, with GitHub's [private vulnerability reporting](https://github.com/chartung17/goodfellow-cms/security/advisories/new): say what the problem is, how to reproduce it, and what someone could do with it. Never include a real token or key.

The maintainer will reply in the report. Once a fix is released, the advisory is published with credit to you, unless you'd rather not be named.

## Supported versions

Only the latest release gets security fixes, since every package is released together with one version number. Update a site with `npm install @goodfellow-cms/admin@latest @goodfellow-cms/blocks@latest @goodfellow-cms/core@latest @goodfellow-cms/github@latest @goodfellow-cms/gitlab@latest @goodfellow-cms/react@latest goodfellow@latest`.
