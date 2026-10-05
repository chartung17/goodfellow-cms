import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/index.server.ts", "src/server.tsx", "src/site-context.tsx"],
  format: "esm",
  dts: true,
  platform: "neutral",
  inputOptions: {
    // "use client" modules are their own entries, so their directive is kept; Next.js's tests depend on it.
    onLog(level, log, handler) {
      if (log.code !== "MODULE_LEVEL_DIRECTIVE") handler(level, log);
    },
  },
});
