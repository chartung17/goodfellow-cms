---
"@goodfellow/registry": patch
---

Custom HTML used exactly as written now runs its scripts whenever its page is shown, also after moving to the page from another one on a Next.js site, where browsers don't run scripts in HTML added to the page. Opened directly, the page runs them once, as before.
