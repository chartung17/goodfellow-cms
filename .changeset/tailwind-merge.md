---
"@goodfellow/react": patch
"@goodfellow/blocks": patch
---

`cx()` now resolves conflicting Tailwind classes with tailwind-merge, so CSS classes added to a block in the editor override the block's own styles.
