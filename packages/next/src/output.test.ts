import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Built by Turborepo before these tests run: see turbo.json.
const next = resolve(import.meta.dirname, "../../../templates/next");
const starter = resolve(import.meta.dirname, "../../../templates/starter");
const read = (file: string) => readFile(join(next, "out", file), "utf8");

/** The part of a page Goodfellow renders: the header, the page and the footer. */
function body(html: string): string {
  const match = /<header class="gf-header">[\s\S]*?<\/footer>/.exec(html);
  if (!match) throw new Error("No Goodfellow page in this HTML.");
  return match[0];
}

async function files(dir: string): Promise<string[]> {
  return (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
    .sort();
}

describe("the Next.js template's static export", () => {
  it("has the starter's content, so it can be compared with the starter", async () => {
    for (const dir of ["content", "public"]) {
      const names = await files(join(starter, dir));
      expect(await files(join(next, dir))).toEqual(names);
      for (const name of names) {
        expect(await readFile(join(next, dir, name), "utf8"), name).toBe(
          await readFile(join(starter, dir, name), "utf8"),
        );
      }
    }
  });

  it("renders every page with the same HTML as goodfellow build", async () => {
    const pages = ["index.html", "about/index.html", "news/index.html", "news/welcome/index.html", "404.html"];
    for (const file of pages) {
      const built = await readFile(join(starter, "dist", file), "utf8");
      expect(body(await read(file)), file).toBe(body(built));
    }
  });

  it("fills in entries' titles and the site's theme", async () => {
    const html = await read("news/welcome/index.html");
    expect(html).toContain("<title>Welcome to our new website | My site</title>");
    expect(html).toMatch(/<style data-precedence="default" data-href="goodfellow-theme">:root\{--background:/);
    expect(await read("404.html")).toContain("<title>Page not found | My site</title>");
  });

  it("includes the admin panel, without the local backend used in development", async () => {
    expect(existsSync(join(next, "out/admin/index.html"))).toBe(true);
    for (const file of await files(join(next, "out"))) {
      if (!/\.(html|js|txt)$/.test(file)) continue;
      expect(await read(file), file).not.toContain("x-goodfellow-request");
    }
  });
});
