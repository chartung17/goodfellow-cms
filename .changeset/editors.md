---
"@goodfellow-cms/core": minor
"@goodfellow-cms/github": minor
"@goodfellow-cms/gitlab": minor
"@goodfellow-cms/admin": minor
---

Editors: **Site settings → Editors** lists who edits the site, and lets owners invite people (by username, or on GitLab by email), make them editors or owners, and remove them. Backends gain an optional `editors` capability. On GitHub, changing editors and GitHub Pages settings needs an owner token, which the new `ownerAccess` keeps in memory for the tab only; it replaces the Pages token link (`PagesDomains.tokenLink` is removed). On GitLab, owners can let editors publish to the main branch.
