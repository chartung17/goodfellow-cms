import { cpSync, mkdirSync, rmSync } from "node:fs";
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
