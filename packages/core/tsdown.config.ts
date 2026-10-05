import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/testing.ts"],
    format: "esm",
    dts: true,
    platform: "neutral",
  },
  {
    // Node only: reads and writes the site's files on disk.
    entry: ["src/node.ts"],
    format: "esm",
    dts: true,
    platform: "node",
    fixedExtension: false,
    clean: false,
    tsconfig: "tsconfig.node.json",
    // Shares the main entry rather than bundling a second copy, so `instanceof ConflictError` works across both.
    deps: { neverBundle: [/^\.\/index\.js$/] },
  },
]);
