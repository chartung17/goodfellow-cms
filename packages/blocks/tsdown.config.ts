import { defineConfig } from "tsdown";

export default defineConfig({
  // The copy button is a Client Component, an entry of its own so its "use client" directive is kept.
  entry: ["src/index.ts", "src/copy-button.tsx"],
  format: "esm",
  dts: true,
  platform: "neutral",
  inputOptions: {
    onLog(level, log, handler) {
      if (log.code !== "MODULE_LEVEL_DIRECTIVE") handler(level, log);
    },
  },
});
