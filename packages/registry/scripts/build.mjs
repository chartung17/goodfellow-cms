// Builds the registry the admin panel installs from: r/<name>.json for each block and each shadcn
// component they use, with the files' contents, and r/registry.json listing them. Each block is stamped
// with this package's version, which the site's record of installed blocks keeps.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const json = async (path) => JSON.parse(await readFile(here(path), "utf8"));

const { version } = await json("package.json");
const registry = await json("registry.json");
const shadcn = await json("shadcn.json");

async function withContents(item) {
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    ...item,
    files: await Promise.all(
      item.files.map(async (file) => ({
        path: file.path.replace(/^site\//, ""),
        type: file.type,
        content: await readFile(here(file.path), "utf8"),
      })),
    ),
  };
}

const blocks = registry.items.map((item) => ({
  ...item,
  dependencies: item.dependencies ?? [],
  meta: { ...item.meta, goodfellow: { ...item.meta.goodfellow, version } },
}));
const items = [...blocks, ...shadcn.items];

await rm(here("r"), { recursive: true, force: true });
await mkdir(here("r"), { recursive: true });
for (const item of items) {
  await writeFile(here(`r/${item.name}.json`), `${JSON.stringify(await withContents(item), null, 2)}\n`);
}
const index = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: registry.name,
  homepage: registry.homepage,
  items: items.map((item) => ({
    ...item,
    files: item.files.map((file) => ({ path: file.path.replace(/^site\//, ""), type: file.type })),
  })),
};
await writeFile(here("r/registry.json"), `${JSON.stringify(index, null, 2)}\n`);
console.log(`Built ${blocks.length} blocks and ${shadcn.items.length} shadcn components into r/.`);
