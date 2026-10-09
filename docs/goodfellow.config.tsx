import { blocks, categories } from "@goodfellow/blocks";
import { defineConfig } from "@goodfellow/core";
import { DocsLayout } from "./blocks/docs-layout";

export default defineConfig({
  // The built-in blocks, and this site's own layout for documentation pages.
  // Never rename a key: pages refer to blocks by it.
  blocks: { ...blocks, DocsLayout },
  categories: { ...categories, docs: { title: "Documentation", components: ["DocsLayout"] } },
  // No `backend`, so builds have no admin panel: .github/workflows/docs.yml publishes the site to GitHub Pages,
  // passing its subfolder as the base path.
});
