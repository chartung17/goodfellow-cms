import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeSearchIndex } from "./node-search.js";

const page = (body: string, main = true) =>
  `<!DOCTYPE html><html lang="en"><head><title>Page</title></head><body><header>Site name</header>${
    main ? `<main data-pagefind-body="">${body}</main>` : `<main>${body}</main>`
  }</body></html>`;

describe("writeSearchIndex", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "goodfellow-search-"));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("indexes nothing when no page has a search block", async () => {
    await writeFile(join(dir, "index.html"), page("<h1>Home</h1>"));
    expect(await writeSearchIndex(dir)).toBeUndefined();
    expect(existsSync(join(dir, "pagefind"))).toBe(false);
  });

  it("indexes pages' main content when one has a search block, leaving out pages without it", async () => {
    await mkdir(join(dir, "about"));
    await mkdir(join(dir, "admin"));
    await writeFile(join(dir, "index.html"), page('<h1>Home</h1><div data-goodfellow-search=""></div>'));
    await writeFile(join(dir, "about/index.html"), page("<h1>About us</h1><p>We grow apples.</p>"));
    await writeFile(join(dir, "404.html"), page("<h1>Page not found</h1>", false));
    await writeFile(join(dir, "admin/index.html"), "<html><body>Admin</body></html>");

    expect(await writeSearchIndex(dir)).toBe(2);
    expect(existsSync(join(dir, "pagefind/pagefind.js"))).toBe(true);
    const entry = JSON.parse(await readFile(join(dir, "pagefind/pagefind-entry.json"), "utf8"));
    expect(Object.values(entry.languages).map((language) => (language as { page_count: number }).page_count)).toEqual([
      2,
    ]);
  }, 60_000);
});
