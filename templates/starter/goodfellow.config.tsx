import { blocks, categories } from "@goodfellow/blocks";
import { defineConfig } from "@goodfellow/core";
// import { github } from "@goodfellow/github";
// import { gitlab } from "@goodfellow/gitlab";
import { installedBlocks, installedCategories } from "./blocks/installed";

export default defineConfig({
  // The built-in blocks, and those installed from the admin panel's Blocks screen.
  // Add your own here too, e.g. `blocks: { ...blocks, ...installedBlocks, MassTimes }`.
  blocks: { ...blocks, ...installedBlocks },
  categories: { ...categories, ...installedCategories },

  // Where the site is stored. Once this is set, builds include the admin panel at /admin.
  // See README.md for how to set up sign-in.
  // backend: github({ repo: "your-name/your-site" }),
  // backend: gitlab({ project: "your-name/your-site", clientId: "your-application-id" }),
});
