import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.tsx", "src/config.ts", "src/admin.tsx"],
  format: "esm",
  dts: true,
  platform: "neutral",
  fixedExtension: false,
  // Next.js resolves these itself, with the right build for server or browser.
  deps: { neverBundle: [/^node:/, /^next(\/|$)/, /^@goodfellow\//, /^@puckeditor\//, /^react(-dom)?(\/|$)/] },
  // Keeps the admin panel's stylesheet imports, for Next.js to bundle.
  treeshake: { moduleSideEffects: (id) => id.endsWith(".css") },
});
