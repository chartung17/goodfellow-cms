import { blocks, categories } from "@goodfellow-cms/blocks";
import { defineConfig } from "@goodfellow-cms/core";
import { DocsLayout } from "./blocks/docs-layout";
import { SiteSetup } from "./blocks/site-setup";

export default defineConfig({
  // The built-in blocks, this site's own layout for documentation pages, and the setup page's form.
  // Never rename a key: pages refer to blocks by it.
  blocks: { ...blocks, DocsLayout, SiteSetup },
  categories: { ...categories, docs: { title: "Documentation", components: ["DocsLayout", "SiteSetup"] } },
  // No `backend`, so builds have no admin panel: .github/workflows/docs.yml publishes the site to GitHub Pages,
  // passing its subfolder as the base path.
});
