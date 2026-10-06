// Copies the shadcn/ui components Goodfellow's blocks use from shadcn's registry into site/components/ui,
// with shadcn.json describing them. shadcn's registry isn't versioned, so each release of this package
// ships the files it was tested with. Run with `pnpm --filter @goodfellow/registry update-shadcn`, check
// the blocks still work, and commit the result.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SHADCN = "https://ui.shadcn.com/r/styles/new-york-v4/{name}.json";
const here = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const FOLDERS = { "registry:ui": "components/ui", "registry:lib": "lib", "registry:hook": "hooks" };

const registry = JSON.parse(await readFile(here("registry.json"), "utf8"));
const wanted = registry.items
  .flatMap((item) => item.registryDependencies ?? [])
  .map((ref) => ref.replace(/^@goodfellow\//, ""));

const items = new Map();
const queue = [...new Set(wanted)];
while (queue.length > 0) {
  const name = queue.shift();
  if (items.has(name)) continue;
  const response = await fetch(SHADCN.replace("{name}", name));
  if (!response.ok) throw new Error(`shadcn's registry has no ${name} (${response.status}).`);
  const item = await response.json();
  items.set(name, item);
  queue.push(...(item.registryDependencies ?? []));
}

/** Imports between shadcn's own files, rewritten to where they're installed, as the shadcn CLI does. */
function rewrite(content) {
  return content
    .replaceAll("@/registry/new-york-v4/ui/", "@/components/ui/")
    .replaceAll("@/registry/new-york-v4/lib/", "@/lib/")
    .replaceAll("@/registry/new-york-v4/hooks/", "@/hooks/");
}

await rm(here("site/components/ui"), { recursive: true, force: true });
const manifest = [];
for (const item of [...items.values()].sort((a, b) => a.name.localeCompare(b.name))) {
  const files = [];
  for (const file of item.files) {
    const folder = FOLDERS[file.type];
    if (!folder) throw new Error(`${item.name} has a ${file.type} file, which the snapshot doesn't handle.`);
    const path = `site/${folder}/${file.path.slice(file.path.lastIndexOf("/") + 1)}`;
    await mkdir(here(path.slice(0, path.lastIndexOf("/"))), { recursive: true });
    await writeFile(here(path), rewrite(file.content));
    files.push({ path, type: file.type });
  }
  manifest.push({
    name: item.name,
    type: item.type,
    dependencies: item.dependencies ?? [],
    registryDependencies: (item.registryDependencies ?? []).map((name) => `@goodfellow/${name}`),
    files,
  });
}
await writeFile(here("shadcn.json"), `${JSON.stringify({ source: SHADCN, items: manifest }, null, 2)}\n`);
console.log(`Copied ${manifest.length} shadcn components: ${manifest.map((item) => item.name).join(", ")}.`);
