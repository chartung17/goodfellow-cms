---
"@goodfellow/ai": minor
"@goodfellow/admin": minor
"@goodfellow/core": minor
---

The AI assistant. A new **AI** tab in every editor writes with AI: it adds blocks to a page, changes the selected block, or fills in a collection item's fields, and its answer goes straight into the editor to check, change or undo. Editors choose the service and use their own key, kept only in their browser: Claude through the official SDK with structured outputs, OpenAI, Gemini, Groq, Mistral, OpenRouter, the keyless OVHcloud AI Endpoints, any OpenAI-compatible service, or any chat app by copy and paste. The new `@goodfellow/ai` package builds the requests, checks answers against the site's blocks and fields, and talks to the services; `@goodfellow/ai/testing` fakes them. Sites can limit the services with `ai: { providers }` or remove the assistant with `ai: false`.
