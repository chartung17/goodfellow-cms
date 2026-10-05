// Builds a copy of the Next.js template to be served from a subfolder, and serves it like a static host.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { preview } from "goodfellow";
import { createNextBuiltSite, NEXT_BASE, nextBuiltSite } from "./site.mjs";

createNextBuiltSite();
const next = createRequire(join(nextBuiltSite, "package.json")).resolve("next/dist/bin/next");
const result = spawnSync(process.execPath, [next, "build"], {
  cwd: nextBuiltSite,
  stdio: "inherit",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", GOODFELLOW_BASE: NEXT_BASE },
});
if (result.status !== 0) process.exit(result.status ?? 1);
await preview({ root: nextBuiltSite, outDir: "out", base: NEXT_BASE, port: Number(process.argv[2] ?? 4404) });
