---
"@goodfellow-cms/core": minor
"@goodfellow-cms/react": minor
"@goodfellow-cms/blocks": minor
"@goodfellow-cms/admin": minor
"@goodfellow-cms/ai": minor
"@goodfellow-cms/github": minor
"@goodfellow-cms/gitlab": minor
"goodfellow": minor
---

The media library. A new **Media** screen uploads, replaces and deletes images and files in `public/media/`, saying where a file is used before deleting it. Image fields in blocks, page settings, collection items and site settings get a **Choose image** button that picks from the library or uploads a new file. Large photos are shrunk, JPEGs lose hidden details such as location, SVGs lose scripts, and only file types that can't run code are accepted. Previews show new uploads straight away, and add the site's base path to media addresses. `FileChange` can now carry `bytes`, and every store implements `readBytes()`, with both backends, their fakes and the development server supporting uploads. `@goodfellow-cms/react` adds `mediaField()`, used by the Image and Section blocks, and the AI assistant is told which images the site has.
