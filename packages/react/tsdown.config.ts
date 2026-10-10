import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/index.server.ts",
    "src/server.tsx",
    "src/site-context.tsx",
    "src/island.tsx",
    "src/hydrate.tsx",
  ],
  format: "esm",
  dts: true,
  platform: "neutral",
  // One file per module, so a Client Component that imports `SiteLink` gets only that, not Puck and the page renderer.
  unbundle: true,
  inputOptions: {
    // "use client" modules are their own entries, so their directive is kept; Next.js's tests depend on it.
    onLog(level, log, handler) {
      if (log.code !== "MODULE_LEVEL_DIRECTIVE") handler(level, log);
    },
  },
});
