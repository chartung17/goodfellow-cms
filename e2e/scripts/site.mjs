import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
