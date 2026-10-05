import { blocks, categories } from "@goodfellow/blocks";
import { defineConfig } from "@goodfellow/core";
// import { github } from "@goodfellow/github";
// import { gitlab } from "@goodfellow/gitlab";

export default defineConfig({
  // Add your own blocks here, e.g. `blocks: { ...blocks, MassTimes }`.
  blocks,
  categories,

  // Where the site is stored. Once this is set, builds include the admin panel at /admin.
  // See README.md for how to set up sign-in.
  // backend: github({ repo: "your-name/your-site" }),
  // backend: gitlab({ project: "your-name/your-site", clientId: "your-application-id" }),
});
