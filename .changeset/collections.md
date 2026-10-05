---
"@goodfellow/core": minor
"@goodfellow/react": minor
"@goodfellow/blocks": minor
"@goodfellow/admin": minor
"goodfellow": minor
---

Collections and templates. A collection, such as videos or events, lives in `content/collections/<name>/`: a `_collection.json` with its fields, an address pattern such as `/videos/{slug}` and a Puck template, plus one file per item. `goodfellow build` and `goodfellow dev` give every item a page from its collection's template, where `{field}` placeholders and the new template-only Entry field block show the item's values. The new Collection list block shows a collection's items on any page, as a list or cards, newest first, upcoming only, and so on. The admin panel has a Collections screen for creating collections, editing their fields and page design, and adding, editing, renaming and deleting items. `@goodfellow/core` adds `allPages()`, `findEntry()` and the collection schemas; `@goodfellow/react` adds a `template` Puck config, `templateOnly()` and `applyEntry()`.
