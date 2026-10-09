import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SEARCH_ATTRIBUTE, SEARCH_INDEX_DIR } from "./search.js";

/** Whether any built page has a search block, which marks itself with `SEARCH_ATTRIBUTE`. */
async function usesSearch(outDir: string, files: string[]): Promise<boolean> {
  for (const file of files) {
    if ((await readFile(join(outDir, file), "utf8")).includes(SEARCH_ATTRIBUTE)) return true;
  }
  return false;
}

/**
 * Writes a Pagefind search index of a built site into `<outDir>/pagefind/`, if any
 * of its pages has a search block; other sites don't get one. Returns how many
 * pages were indexed, or `undefined` if the site has no search.
 */
export async function writeSearchIndex(outDir: string): Promise<number | undefined> {
  const pages = (await readdir(outDir, { recursive: true }))
    .map((file) => file.split("\\").join("/"))
    .filter((file) => file.endsWith(".html") && !file.startsWith("admin/") && !file.startsWith(`${SEARCH_INDEX_DIR}/`));
  const indexDir = join(outDir, SEARCH_INDEX_DIR);
  await rm(indexDir, { recursive: true, force: true });
  if (!(await usesSearch(outDir, pages))) return undefined;

  // Loaded only when needed: Pagefind runs a program of its own.
  const pagefind = await import("pagefind");
  try {
    const { index, errors } = await pagefind.createIndex({});
    if (!index) throw new Error(`Pagefind couldn't start: ${errors.join("; ")}`);
    // Pages mark the content to index with data-pagefind-body, so headers, footers and "Page not found" are left out.
    const added = await index.addDirectory({ path: outDir, glob: `{${pages.join(",")}}` });
    if (added.errors.length > 0) throw new Error(`Pagefind couldn't index the site: ${added.errors.join("; ")}`);
    // Pagefind's writeFiles can answer before every file is on disk, so the index is written here instead.
    const built = await index.getFiles();
    if (built.errors.length > 0) throw new Error(`Pagefind couldn't write the index: ${built.errors.join("; ")}`);
    for (const file of built.files) {
      const path = join(indexDir, file.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, file.content);
    }
    // The pages indexed, which leaves out those without content marked for it.
    const entryFile = built.files.find((file) => file.path === "pagefind-entry.json");
    if (!entryFile) throw new Error("Pagefind didn't make pagefind-entry.json");
    const entry = JSON.parse(new TextDecoder().decode(entryFile.content)) as {
      languages: Record<string, { page_count: number }>;
    };
    return Object.values(entry.languages).reduce((total, language) => total + language.page_count, 0);
  } finally {
    await pagefind.close();
  }
}
