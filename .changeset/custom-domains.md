---
"@goodfellow-cms/core": minor
"@goodfellow-cms/github": minor
"@goodfellow-cms/gitlab": minor
"@goodfellow-cms/admin": minor
---

Custom domains: **Site settings → Domain** connects a domain to a site on GitHub Pages or GitLab Pages, lists the records to add at the registrar, and checks until it works (the records, the host's HTTPS certificate, and the site at its new address), then sends everyone to the secure address. Backends' new optional `pages` capability does the host's part; `checkRecords()` and `domainZone()` in core check DNS. GitHub tokens need the Pages permission to connect a domain, and the screen links to one that has it. Where editors sign in by being sent to the host and back, the screen reminds owners to allow the admin panel's new address.
