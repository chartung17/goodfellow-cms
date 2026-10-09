import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** The starter template, which every test starts from. */
export const starter = join(here, "../../templates/starter");

/** A copy of the starter that tests edit freely. Inside e2e/ so it resolves this package's dependencies. */
export const site = join(here, "../.site");

/** Folders that installing blocks from the admin panel's Blocks screen writes to. */
const INSTALLED_CODE = ["components", "lib", "hooks"];

/**
 * Resets a site's editable files to those of `from`: content, media and installed blocks. Returns
 * whether it reset blocks' code, which a running dev server takes a moment to notice.
 */
function resetEditable(root, from) {
  // Code is only reset when a test added blocks (or the site is new), so other tests don't make the dev
  // server reload modules.
  const hadBlocks = existsSync(join(root, "blocks/installed/installed.json"));
  const resetCode = hadBlocks || !existsSync(join(root, "blocks/installed/index.ts"));
  for (const dir of ["content", "public", ...(resetCode ? ["blocks/installed", ...INSTALLED_CODE] : [])]) {
    // Empties folders rather than removing them: a dev server's watcher can miss later changes in a
    // folder that was removed and made again.
    const target = join(root, dir);
    if (existsSync(target)) {
      for (const name of readdirSync(target)) rmSync(join(target, name), { recursive: true, force: true });
    }
    // Some sites have files of their own there, such as the Next.js starter's lib/site.ts.
    if (existsSync(join(from, dir))) cpSync(join(from, dir), target, { recursive: true });
  }
  return hadBlocks;
}

/** Resets the test site's editable files to the starter's. Returns whether it reset blocks' code. */
export function resetContent() {
  return resetEditable(site, starter);
}

/** Blocks with Client Components, which every test site has besides the starter's. */
const testBlocks = join(here, "../fixtures/blocks");

/** A test site's config: the starter's blocks, the test blocks, and optionally a backend. */
function testConfig({ from = "./blocks", importLine = "", backend = "", demo = false } = {}) {
  return [
    'import { blocks, categories } from "@goodfellow-cms/blocks";',
    'import { defineConfig } from "@goodfellow-cms/core";',
    ...(importLine ? [importLine] : []),
    `import { Counter, Disclosure } from ${JSON.stringify(`${from}/counter`)};`,
    `import { installedBlocks, installedCategories } from ${JSON.stringify(`${from}/installed`)};`,
    "",
    "export default defineConfig({",
    "  blocks: { ...blocks, ...installedBlocks, Counter, Disclosure },",
    "  categories: { ...categories, ...installedCategories },",
    ...(backend ? [`  backend: ${backend},`] : []),
    ...(demo ? ["  demo: true,"] : []),
    "});",
    "",
  ].join("\n");
}

/** A page with the test blocks, for tests to add to a site's content. */
export const islandsPage = {
  version: 1,
  data: {
    content: [
      { type: "Counter", props: { id: "Counter-1", className: "", label: "Clicked" } },
      { type: "Disclosure", props: { id: "Disclosure-1", className: "", title: "More", open: false } },
      { type: "Disclosure", props: { id: "Disclosure-2", className: "", title: "Shown", open: true } },
    ],
    root: { props: { className: "", description: "", image: "", title: "Islands" } },
  },
};

/** Creates the test site from the starter. */
export function createSite() {
  rmSync(site, { recursive: true, force: true });
  mkdirSync(site, { recursive: true });
  cpSync(join(starter, "src"), join(site, "src"), { recursive: true });
  cpSync(testBlocks, join(site, "blocks"), { recursive: true });
  writeFileSync(join(site, "goodfellow.config.tsx"), testConfig());
  resetContent();
}

/** Backends for the built test sites. Each site is a production build of the starter, served like a static host. */
export const builtSites = {
  github: {
    port: 4401,
    importLine: 'import { github } from "@goodfellow-cms/github";',
    backend: 'github({ repo: "parish/site" })',
  },
  gitlab: {
    port: 4402,
    importLine: 'import { gitlab } from "@goodfellow-cms/gitlab";',
    backend: 'gitlab({ project: "parish/site", clientId: "test-client" })',
  },
  // A demo, which anyone can try without signing in.
  demo: { port: 4405, demo: true },
};

/** Creates a copy of the starter configured with a git backend or as a demo, ready for `goodfellow build`. */
export function createBuiltSite(name) {
  const { importLine, backend, demo } = builtSites[name];
  const dir = join(here, `../.site-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const entry of ["content", "public", "src", "blocks"]) {
    cpSync(join(starter, entry), join(dir, entry), { recursive: true });
  }
  cpSync(testBlocks, join(dir, "blocks"), { recursive: true });
  writeFileSync(join(dir, "content/pages/islands.json"), `${JSON.stringify(islandsPage, null, 2)}\n`);
  writeFileSync(join(dir, "goodfellow.config.tsx"), testConfig({ importLine, backend, demo }));
  return dir;
}

/** The starter's editable files, as the contents of the fake repository the built sites edit. */
export function starterFiles() {
  const files = {};
  for (const dir of ["content", "public/media"]) {
    for (const file of readdirSync(join(starter, dir), { recursive: true })) {
      const path = join(starter, dir, file);
      if (statSync(path).isFile()) files[`${dir}/${file.split("\\").join("/")}`] = readFileSync(path, "utf8");
    }
  }
  return files;
}

/** The Next.js template, and a copy of it that tests run `next dev` on. */
export const nextTemplate = join(here, "../../templates/next");
export const nextSite = join(here, "../.site-next");

/** Resets the Next.js test site's editable files to the template's. Returns whether it reset blocks' code. */
export function resetNextContent() {
  return resetEditable(nextSite, nextTemplate);
}

/** Copies the Next.js template to `dir`, using the template's installed packages. */
function copyNextTemplate(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(nextTemplate)) {
    if (["node_modules", ".next", "out", ".turbo"].includes(entry)) continue;
    cpSync(join(nextTemplate, entry), join(dir, entry), { recursive: true });
  }
  symlinkSync(join(nextTemplate, "node_modules"), join(dir, "node_modules"), "dir");
}

/** Creates the Next.js test site, with an extra block whose component runs in the browser. */
export function createNextSite() {
  copyNextTemplate(nextSite);
  cpSync(testBlocks, join(nextSite, "blocks"), { recursive: true });
  writeFileSync(join(nextSite, "goodfellow.config.tsx"), testConfig({ from: "@/blocks" }));
  resetNextContent();
}

/** A copy of the Next.js template that's built to be served from a subfolder. */
export const nextBuiltSite = join(here, "../.site-next-base");
export const NEXT_BASE = "/site/";

export function createNextBuiltSite() {
  copyNextTemplate(nextBuiltSite);
}
