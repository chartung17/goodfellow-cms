// Copies the starter and the examples into templates/, with the version of every
// Goodfellow package, so the published create-goodfellow has everything it copies.
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyTemplate } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../../..");
const out = join(here, "../templates");

const sources = { starter: "templates/starter", parish: "examples/parish" };

rmSync(out, { recursive: true, force: true });
for (const [name, source] of Object.entries(sources)) {
  await copyTemplate(join(repo, source), join(out, name), { bundling: true });
}

const versions = {};
for (const dir of readdirSync(join(repo, "packages"))) {
  const pkg = JSON.parse(readFileSync(join(repo, "packages", dir, "package.json"), "utf8"));
  if (!pkg.private) versions[pkg.name] = pkg.version;
}
writeFileSync(join(out, "versions.json"), `${JSON.stringify(versions, null, 2)}\n`);
