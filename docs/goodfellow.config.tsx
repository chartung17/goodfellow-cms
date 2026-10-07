import { blocks, categories } from "@goodfellow/blocks";
import { defineConfig } from "@goodfellow/core";
import { DocsLayout } from "./blocks/docs-layout";

export default defineConfig({
  // The built-in blocks, and this site's own layout for documentation pages.
  // Never rename a key: pages refer to blocks by it.
  blocks: { ...blocks, DocsLayout },
  categories: { ...categories, docs: { title: "Documentation", components: ["DocsLayout"] } },
  // The site is put online in roadmap step 13, which sets `backend` and `base`.
});
