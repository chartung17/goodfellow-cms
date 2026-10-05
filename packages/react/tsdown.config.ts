import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/server.tsx"],
  format: "esm",
  dts: true,
  platform: "neutral",
});
