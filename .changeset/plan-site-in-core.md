---
"@goodfellow-cms/core": minor
"create-goodfellow": minor
---

Creating a site from a template is worked out by `planSite()` in `@goodfellow-cms/core`, which needs no disk, so the documentation site's setup page and `create-goodfellow` make the same sites. The templates, hosts and block choices, and the helpers `create-goodfellow` exported, are in `@goodfellow-cms/core` too; `create-goodfellow` still exports them, and its `installRecommendedBlocks()` is replaced by core's, which works on a site's files rather than a folder.
