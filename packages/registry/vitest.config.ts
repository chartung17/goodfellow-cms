import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // As in a site, `@/` is the site's root, where blocks find the shadcn components they use.
  resolve: { alias: { "@/": fileURLToPath(new URL("./site/", import.meta.url)) } },
});
