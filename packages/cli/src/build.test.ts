import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "./build.js";

const fixture = resolve(import.meta.dirname, "../test/fixtures/site");
const starter = resolve(import.meta.dirname, "../../../templates/starter");
const parish = resolve(import.meta.dirname, "../../../examples/parish");

describe("build", () => {
  let outDir: string;
  let pages: string[];

  beforeAll(async () => {
    outDir = await mkdtemp(join(tmpdir(), "goodfellow-build-"));
    ({ pages } = await build({ root: fixture, outDir }));
  }, 60_000);

  afterAll(() => rm(outDir, { recursive: true, force: true }));

  const read = (file: string) => readFile(join(outDir, file), "utf8");

  it("writes one HTML file per page, with clean URLs", () => {
    expect(pages).toHaveLength(4);
    expect(existsSync(join(outDir, "index.html"))).toBe(true);
    expect(existsSync(join(outDir, "news/index.html"))).toBe(true);
    expect(existsSync(join(outDir, "404.html"))).toBe(true);
  });

  it("renders blocks defined in the site's TSX config", async () => {
    const html = await read("index.html");
    expect(html).toContain('<p class="greeting text-teal-600">Hello, <!-- -->world<!-- -->!</p>');
    expect(html).toContain('<div class="bg-rose-200">');
  });

  it("builds a page for each entry in a collection, from its template", async () => {
    const html = await read("talks/hope/index.html");
    expect(html).toContain("<title>On hope</title>");
    expect(html).toContain("Hello, <!-- -->Fr. Smith<!-- -->!");
  });

  it("applies the config's base path to every root-relative URL", async () => {
    const html = await read("index.html");
    expect(html).toMatch(/<link rel="stylesheet" href="\/from-config\/assets\/styles-[\w-]+\.css"\/>/);
    expect(html).toContain('href="/from-config/news"');
  });

  it("builds CSS that includes classes from the content and config, plus custom CSS", async () => {
    const [cssFile] = await readdir(join(outDir, "assets"));
    const css = await read(`assets/${cssFile}`);
    expect(css).toContain(".bg-rose-200");
    expect(css).toContain(".text-teal-600");
    expect(css).toContain(".custom-rule");
    // Theme colors resolve to the CSS variables written from site.json.
    expect(css).toMatch(/\.bg-primary\{background-color:var\(--primary\)\}/);
  });

  it("copies the public folder", async () => {
    expect(await read("media/note.txt")).toBe("hello\n");
  });

  it("writes a sitemap and robots.txt when the site's address is set", async () => {
    const sitemap = await read("sitemap.xml");
    expect(sitemap).toContain("<loc>https://example.org/site/</loc>");
    expect(sitemap).toContain("<loc>https://example.org/site/news</loc>");
    expect(sitemap).toContain("<loc>https://example.org/site/talks/hope</loc>");
    expect(sitemap).not.toContain("404");
    expect(await read("robots.txt")).toContain("Sitemap: https://example.org/site/sitemap.xml");
  });

  it("builds the starter template", async () => {
    const starterOut = await mkdtemp(join(tmpdir(), "goodfellow-starter-"));
    try {
      const result = await build({ root: starter, outDir: starterOut, base: "/" });
      // Four pages, plus a page for each of the two news stories.
      expect(result.pages).toHaveLength(6);
      const html = await readFile(join(starterOut, "about/index.html"), "utf8");
      expect(html).toContain("<title>About us | My site</title>");
      expect(html).toContain('<nav aria-label="main">');
      const story = await readFile(join(starterOut, "news/welcome/index.html"), "utf8");
      expect(story).toContain("<title>Welcome to our new website | My site</title>");
    } finally {
      await rm(starterOut, { recursive: true, force: true });
    }
  }, 60_000);

  it("builds the parish example, with its own blocks and the site's contact details", async () => {
    const parishOut = await mkdtemp(join(tmpdir(), "goodfellow-parish-"));
    try {
      const result = await build({ root: parish, outDir: parishOut, base: "/" });
      // Nine pages, plus four events, three news stories and two bulletins. Staff have no pages of their own.
      expect(result.pages).toHaveLength(18);
      const home = await readFile(join(parishOut, "index.html"), "utf8");
      expect(home).toContain("<title>St. Joseph Parish, Anytown</title>");
      expect(home).toContain("Weekend Masses");
      expect(home).toContain('href="tel:5550100100"');
      const bulletin = await readFile(join(parishOut, "bulletins/2026-10-04/index.html"), "utf8");
      expect(bulletin).toContain('href="/media/bulletin-example.pdf"');
      const about = await readFile(join(parishOut, "about/index.html"), "utf8");
      expect(about.indexOf("Fr. Thomas Reed")).toBeLessThan(about.indexOf("Maria Chen"));
    } finally {
      await rm(parishOut, { recursive: true, force: true });
    }
  }, 60_000);
});

describe.each([
  ["starter template", starter],
  ["parish example", parish],
])("%s", (_name, root) => {
  it("stores content files in the canonical format the admin panel writes", async () => {
    const { serializeContent } = await import("@goodfellow/core");
    const contentDir = join(root, "content");
    const files = (await readdir(contentDir, { recursive: true })).filter((file) => file.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = await readFile(join(contentDir, file), "utf8");
      expect(text, file).toBe(serializeContent(JSON.parse(text)));
    }
  });
});

describe("parish example", () => {
  it("has the same deploy setups as the starter", async () => {
    for (const file of [
      ".github/workflows/deploy.yml",
      ".gitlab-ci.yml",
      "vercel.json",
      ".gitignore",
      "src/styles.css",
    ]) {
      expect(await readFile(join(parish, file), "utf8"), file).toBe(await readFile(join(starter, file), "utf8"));
    }
  });
});
