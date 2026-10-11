---
"@goodfellow-cms/core": minor
"@goodfellow-cms/blocks": minor
"@goodfellow-cms/admin": minor
---

Forms: a Form block whose questions are set in the editor. It's a plain HTML form, with no JavaScript, that posts its answers to the form service chosen in Site settings (Web3Forms by default, Formspree, or any service that takes a plain form post), which emails them and sends visitors back to a thank-you page. Every form has a hidden honeypot field, and Web3Forms' hCaptcha can be turned on in Site settings. The block can also show a Google form from its embed code. `formTarget()`, `formRedirect()` and `googleFormUrl()` are in `@goodfellow-cms/core`, and `content/site.json` has a new optional `forms` setting.
