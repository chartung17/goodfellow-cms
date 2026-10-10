---
version: 1
title: AI assistant
description: Draft and rewrite content with AI, using Claude, OpenAI, a free service or any chat app.
section: editors
order: 6
---

The **AI** tab beside the editor writes with AI. Describe what you want:

- With nothing selected, it adds new blocks to the end of the page.
- With a block selected, it changes that block.
- For a collection's item, it fills in the item's fields.

The result goes straight into the editor, so you can check it, change it or undo it before publishing. It's told never to make up facts such as times or names, and to leave `[placeholders]` instead.

## Choosing a service

Each editor chooses a service in the AI tab's settings, and it's called straight from their browser, with their own account:

| Service | Needs | Cost |
|---|---|---|
| Claude (Opus 5.5, Sonnet 5.5 or Haiku 4.5) | An API key from the [Claude Console](https://platform.claude.com/settings/keys) | Charged per use, roughly a few cents for a page |
| OpenAI, Google Gemini, Groq, Mistral, OpenRouter | An API key from the service | Gemini, Groq, Mistral and OpenRouter have free tiers with limits |
| OVHcloud AI Endpoints | Nothing | Free, about 2 requests a minute |
| A chat app such as Claude.ai or ChatGPT | Copying the request in and the answer back | Whatever your chat app plan includes |
| Any other OpenAI-compatible service | Its address, and a key if it needs one | Varies |

Keys stay in the editor's browser, for the session or on the device if they choose, and they're forgotten on sign-out. They're only ever sent to the service they belong to. Free models write less reliably, so answers are always checked against the site's blocks before they're used.

A site's developer can limit the services offered, or turn the assistant off; see [Configuration](/docs/configuration).
