import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { ContentSource } from "@goodfellow/core";

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

/** Reads a site's files from disk. Paths are relative to the site root and always use `/`. */
export function fileSystemSource(root: string): ContentSource {
  return {
    async read(path) {
      try {
        return await readFile(join(root, path), "utf8");
      } catch (error) {
        if (isMissing(error)) return undefined;
        throw error;
      }
    },
    async list(dir) {
      try {
        const entries = await readdir(join(root, dir), { recursive: true, withFileTypes: true });
        return entries
          .filter((entry) => entry.isFile())
          .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join("/"))
          .sort();
      } catch (error) {
        if (isMissing(error)) return [];
        throw error;
      }
    },
  };
}
