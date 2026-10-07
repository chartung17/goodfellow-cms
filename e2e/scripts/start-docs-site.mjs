// The documentation site, built and served from /goodfellow-cms/, as GitHub Pages will serve it.
import { fileURLToPath } from "node:url";
import { build, preview } from "goodfellow";

const root = fileURLToPath(new URL("../../docs", import.meta.url));
const outDir = fileURLToPath(new URL("../.site-docs", import.meta.url));
const base = "/goodfellow-cms/";
await build({ root, outDir, base });
await preview({ root, outDir, base, port: Number(process.argv[2] ?? 4406) });
