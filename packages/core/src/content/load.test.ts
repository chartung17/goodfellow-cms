import { describe, expect, it } from "vitest";
import { ContentError } from "./errors.js";
import { allPages, type ContentSource, findEntry, loadSiteContent } from "./load.js";

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

describe("collections", () => {
  const collection = {
    version: 1,
    name: "Videos",
    entryName: "Video",
    path: "/videos/{slug}",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "date", label: "Date", type: "date" },
    ],
    sort: { field: "date", order: "desc" },
    template: { root: { props: { title: "{title}" } }, content: [] },
  };
  const entry = (title: string, date?: string) => ({ version: 1, fields: { title, ...(date && { date }) } });

  it("loads collections with their entries in order, and gives entries pages", async () => {
    const content = await loadSiteContent(
      memorySource({
        "content/pages/index.json": page("Home"),
        "content/collections/videos/_collection.json": collection,
        "content/collections/videos/advent.json": entry("Advent", "2025-12-01"),
        "content/collections/videos/easter.json": entry("Easter", "2026-04-05"),
        "content/collections/staff/_collection.json": {
          ...collection,
          name: "Staff",
          path: undefined,
          sort: undefined,
        },
        "content/collections/staff/pat.json": entry("Pat"),
      }),
    );

    expect(content.collections.map((c) => c.id)).toEqual(["staff", "videos"]);
    const videos = content.collections[1];
    expect(videos?.entries.map((e) => [e.slug, e.path])).toEqual([
      ["easter", "/videos/easter"],
      ["advent", "/videos/advent"],
    ]);
    expect(content.collections[0]?.entries[0]?.path).toBeUndefined();

    const pages = allPages(content);
    expect(pages.map((p) => p.path)).toEqual(["/", "/videos/advent", "/videos/easter"]);
    expect(pages[2]?.entry).toEqual({ collection: "videos", slug: "easter" });
    expect(pages[2]?.content.data.root.props).toEqual({ title: "{title}" });
    expect(findEntry(content, "videos", "advent")?.entry.content.fields.title).toBe("Advent");
  });

  it("reports problems with collections and entries", async () => {
    const error = await loadSiteContent(
      memorySource({
        "content/pages/videos/easter.json": page("Clash"),
        "content/collections/videos/_collection.json": collection,
        "content/collections/videos/easter.json": entry("Easter"),
        "content/collections/videos/Bad.json": entry("Bad"),
        "content/collections/videos/late.json": { version: 1, fields: { date: "soon" } },
        "content/collections/videos/old/nested.json": entry("Nested"),
        "content/collections/orphans/stray.json": entry("Stray"),
        "content/collections/broken/_collection.json": { ...collection, fields: [] },
      }),
    ).catch((caught: unknown) => caught);

    expect((error as ContentError).problems).toEqual([
      { file: "content/collections/broken/_collection.json", message: expect.stringMatching(/fields/) },
      { file: "content/collections/orphans/stray.json", message: expect.stringMatching(/no _collection\.json/) },
      { file: "content/collections/videos/Bad.json", message: expect.stringMatching(/can't be used/) },
      {
        file: "content/collections/videos/easter.json",
        message: "has the same address (/videos/easter) as content/pages/videos/easter.json. Rename one of them.",
      },
      { file: "content/collections/videos/late.json", message: "fields.date must be a date written as YYYY-MM-DD" },
      { file: "content/collections/videos/old/nested.json", message: expect.stringMatching(/wrong place/) },
    ]);
  });
});
