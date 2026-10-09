---
"@goodfellow-cms/registry": minor
"@goodfellow-cms/admin": minor
"@goodfellow-cms/core": minor
"create-goodfellow": minor
"goodfellow": minor
"@goodfellow-cms/next": minor
"@goodfellow-cms/react": minor
"@goodfellow-cms/gitlab": patch
---

Blocks from block registries. The admin panel has a **Blocks** screen that adds blocks built with shadcn/ui to the editor, and removes them, with no developer: adding one publishes its code into the site's `blocks/installed/` and the shadcn components it uses into `components/ui/`, in one commit, and the editor offers it once the site has been rebuilt. Removing a block is refused while content uses it, and keeps files someone has changed.

`@goodfellow-cms/registry` is Goodfellow's registry, with nine blocks: Hero, Cards, Call to action, Testimonials, Notice, Pricing table, FAQ, Tabs and Image carousel. Its README documents the format for registries of blocks built with other libraries, which a site offers once its config lists them in `registries`.

`create-goodfellow` starts new sites with the recommended blocks, or with `--blocks built-in` the built-in blocks only. `@goodfellow-cms/core` plans installs and removals (`planInstall()`, `planRemove()`), and its stores and the GitLab backend read and write the folders installed blocks use. `goodfellow dev` and `next dev` serve the site's copy of the registry, and `goodfellow` resolves `@/` imports from the site's root, as shadcn code expects. `@goodfellow-cms/react`'s theme adds the colors shadcn components use, such as `card` and `destructive`.
