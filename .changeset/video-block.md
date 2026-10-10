---
"@goodfellow-cms/core": minor
"@goodfellow-cms/blocks": minor
"@goodfellow-cms/react": minor
"@goodfellow-cms/admin": minor
"@goodfellow-cms/ai": minor
---

A Video block: a video from the media library (MP4 or WebM, with a picture before it plays and WebVTT captions), YouTube (from its ID or any of its addresses, in the privacy-enhanced player), Vimeo (with do not track), or another site's player (from its embed address or code, sandboxed, and only from another secure site). It needs no JavaScript on the page. `youtubeVideo()`, `vimeoVideo()`, `embedPlayerUrl()` and the player addresses' helpers are in `@goodfellow-cms/core`. Media fields can hold videos (`mediaField(label, "video")`), whose chooser offers only videos, and WebVTT files can be uploaded.
