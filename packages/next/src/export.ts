import { readdir, rename, rm } from "node:fs/promises";
import { join, relative } from "node:path";

/**
 * Puts a static export's prefetch files where the browser asks for them.
 * Next.js names each after its segment path with `/` turned into `.`
 * (`__next.$oc$path.__PAGE__.txt`), but on Windows the path has `\` instead, so
 * the export writes folders (`__next.$oc$path/__PAGE__.txt`), and every
 * prefetch is "not found". Returns how many files it moved; none elsewhere.
 */
export async function fixSegmentFiles(outDir: string): Promise<number> {
  let moved = 0;
  async function visit(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "_next") continue;
      const path = join(dir, entry.name);
      if (!entry.name.startsWith("__next.")) {
        await visit(path);
        continue;
      }
      for (const file of await readdir(path, { recursive: true, withFileTypes: true })) {
        if (!file.isFile()) continue;
        const source = join(file.parentPath, file.name);
        const parts = relative(path, source).split(/[\\/]/);
        await rename(source, join(dir, [entry.name, ...parts].join(".")));
        moved++;
      }
      await rm(path, { recursive: true, force: true });
    }
  }
  await visit(outDir);
  return moved;
}
