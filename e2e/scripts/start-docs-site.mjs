// The documentation site, built and served from /goodfellow-cms/, as GitHub Pages will serve it.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build, preview } from "goodfellow";

const root = fileURLToPath(new URL("../../docs", import.meta.url));
const outDir = fileURLToPath(new URL("../.site-docs", import.meta.url));
const base = "/goodfellow-cms/";
// The setup page's starters, without lockfiles, which would need the versions to be on npm.
execFileSync(process.execPath, ["scripts/starters.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, GOODFELLOW_STARTER_LOCKFILES: "" },
});
await build({ root, outDir, base });
await preview({ root, outDir, base, port: Number(process.argv[2] ?? 4406) });
