import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** The starter template, which every test starts from. */
export const starter = join(here, "../../templates/starter");

/** A copy of the starter that tests edit freely. Inside e2e/ so it resolves this package's dependencies. */
export const site = join(here, "../.site");

/** Resets the test site's editable files to the starter's. */
export function resetContent() {
  for (const dir of ["content", "public"]) {
    rmSync(join(site, dir), { recursive: true, force: true });
    cpSync(join(starter, dir), join(site, dir), { recursive: true });
  }
}

/** Creates the test site from the starter. */
export function createSite() {
  rmSync(site, { recursive: true, force: true });
  mkdirSync(site, { recursive: true });
  for (const entry of ["goodfellow.config.tsx", "src"]) {
    cpSync(join(starter, entry), join(site, entry), { recursive: true });
  }
  resetContent();
}

/** Backends for the built test sites. Each site is a production build of the starter, served like a static host. */
export const builtSites = {
  github: {
    port: 4401,
    importLine: 'import { github } from "@goodfellow/github";',
    backend: 'github({ repo: "parish/site" })',
  },
  gitlab: {
    port: 4402,
    importLine: 'import { gitlab } from "@goodfellow/gitlab";',
    backend: 'gitlab({ project: "parish/site", clientId: "test-client" })',
  },
};

/** Creates a copy of the starter configured with a git backend, ready for `goodfellow build`. */
export function createBuiltSite(name) {
  const { importLine, backend } = builtSites[name];
  const dir = join(here, `../.site-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const entry of ["content", "public", "src"]) cpSync(join(starter, entry), join(dir, entry), { recursive: true });
  writeFileSync(
    join(dir, "goodfellow.config.tsx"),
    [
      'import { blocks, categories } from "@goodfellow/blocks";',
      'import { defineConfig } from "@goodfellow/core";',
      importLine,
      "",
      `export default defineConfig({ blocks, categories, backend: ${backend} });`,
      "",
    ].join("\n"),
  );
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

/** Resets the Next.js test site's editable files to the template's. */
export function resetNextContent() {
  for (const dir of ["content", "public"]) {
    rmSync(join(nextSite, dir), { recursive: true, force: true });
    cpSync(join(nextTemplate, dir), join(nextSite, dir), { recursive: true });
  }
}

/** The Next.js test site's config: the template's blocks, plus one with a Client Component. */
const NEXT_CONFIG = `import { blocks, categories } from "@goodfellow/blocks";
import { defineConfig } from "@goodfellow/core";
import { Counter } from "@/blocks/counter";

export default defineConfig({ blocks: { ...blocks, Counter }, categories });
`;

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
  cpSync(join(here, "../fixtures/next-blocks"), join(nextSite, "blocks"), { recursive: true });
  writeFileSync(join(nextSite, "goodfellow.config.tsx"), NEXT_CONFIG);
  resetNextContent();
}

/** A copy of the Next.js template that's built to be served from a subfolder. */
export const nextBuiltSite = join(here, "../.site-next-base");
export const NEXT_BASE = "/site/";

export function createNextBuiltSite() {
  copyNextTemplate(nextBuiltSite);
}
