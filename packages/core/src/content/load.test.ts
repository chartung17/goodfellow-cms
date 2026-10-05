import { describe, expect, it } from "vitest";
import { ContentError } from "./errors.js";
import { type ContentSource, loadSiteContent } from "./load.js";

function memorySource(files: Record<string, unknown>): ContentSource {
  const text = Object.fromEntries(
    Object.entries(files).map(([path, value]) => [path, typeof value === "string" ? value : JSON.stringify(value)]),
  );
  return {
    read: async (path) => text[path],
    list: async (dir) => Object.keys(text).filter((path) => path.startsWith(`${dir}/`)),
  };
}

const page = (title: string) => ({ version: 1, data: { root: { props: { title } }, content: [] } });

describe("loadSiteContent", () => {
  it("loads a site with sensible defaults for missing files", async () => {
    const content = await loadSiteContent(memorySource({ "content/pages/index.json": page("Home") }));
    expect(content.settings.title).toBe("My site");
    expect(content.settings.language).toBe("en");
    expect(content.menus).toEqual({});
    expect(content.header.data.content).toEqual([]);
    expect(content.customCss).toBe("");
    expect(content.pages.map((p) => p.path)).toEqual(["/"]);
  });

  it("loads every page, sorted by address", async () => {
    const content = await loadSiteContent(
      memorySource({
        "content/pages/news/index.json": page("News"),
        "content/pages/about.json": page("About"),
        "content/pages/index.json": page("Home"),
        "content/pages/readme.txt": "ignored",
      }),
    );
    expect(content.pages.map((p) => [p.path, p.file])).toEqual([
      ["/", "content/pages/index.json"],
      ["/about", "content/pages/about.json"],
      ["/news", "content/pages/news/index.json"],
    ]);
  });

  it("reports every problem at once", async () => {
    const error = await loadSiteContent(
      memorySource({
        "content/site.json": { version: 1, theme: { colors: { primary: "red;}</style>" } } },
        "content/menus.json": "{ not json",
        "content/pages/index.json": { version: 9, data: {} },
        "content/pages/Bad_Name.json": page("Bad"),
        "content/pages/ok.json": { version: 1, data: { content: [{ type: "Heading", props: {} }] } },
      }),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ContentError);
    const problems = (error as ContentError).problems;
    expect(problems.map((p) => p.file)).toEqual([
      "content/menus.json",
      "content/pages/Bad_Name.json",
      "content/pages/index.json",
      "content/pages/ok.json",
      "content/site.json",
    ]);
    expect(problems[0]?.message).toMatch(/valid JSON/);
    expect(problems[2]?.message).toMatch(/newer version/);
    expect(problems[3]?.message).toMatch(/content\.0\.props\.id/);
    expect(problems[4]?.message).toMatch(/CSS color/);
  });

  it("reports two files serving the same address", async () => {
    const error = await loadSiteContent(
      memorySource({
        "content/pages/about.json": page("About"),
        "content/pages/about/index.json": page("About again"),
      }),
    ).catch((caught: unknown) => caught);
    expect((error as ContentError).problems).toEqual([
      {
        file: "content/pages/about/index.json",
        message: "serves the same address (/about) as content/pages/about.json. Remove one of them.",
      },
    ]);
  });
});

describe("reserved addresses", () => {
  it("refuses a page at the admin panel's address", async () => {
    const error = await loadSiteContent(memorySource({ "content/pages/admin.json": page("Admin") })).catch(
      (caught: unknown) => caught,
    );
    expect((error as ContentError).problems[0]?.message).toMatch(/reserved for the admin panel/);
  });
});
