---
"@goodfellow-cms/core": minor
"@goodfellow-cms/react": minor
"@goodfellow-cms/next": minor
"@goodfellow-cms/admin": minor
---

Site settings has a Code tab for code from services such as Google Analytics: "In the page head" (script, style, link, meta, base and noscript tags, read with `parseHeadCode()`) and "At the end of the page" (any HTML), saved as `content/code/head.html` and `content/code/body.html`. `goodfellow build` and Next.js add it to every page with `HeadCode` and `BodyCode`; it never runs in the admin panel.
