import { type Page, siteSettingsSchema } from "@goodfellow/core";
import { describe, expect, it } from "vitest";
import {
  checkPageAddress,
  customCssFileChange,
  movePageChanges,
  pageFileChange,
  pageTitle,
  siteSettingsFileChange,
  slugify,
  storedCss,
  storedData,
  updateMenuLinks,
} from "./changes.js";

const page = (path: string, title?: string): Page => ({
  path,
  file: path === "/" ? "content/pages/index.json" : `content/pages${path}.json`,
  content: { version: 1, data: { root: { props: title ? { title } : {} }, content: [] } },
});

const pages = [page("/", "Home"), page("/about", "About us")];

describe("slugify", () => {
  it.each([
    ["Mass & Confession Times", "mass-confession-times"],
    ["  Café Menu!  ", "cafe-menu"],
    ["2026 Picnic", "2026-picnic"],
    ["", ""],
  ])("%s → %s", (input, output) => {
    expect(slugify(input)).toBe(output);
  });
});

describe("pageTitle", () => {
  it("uses the page's title, or its address", () => {
    expect(pageTitle(page("/about", " About us "))).toBe("About us");
    expect(pageTitle(page("/untitled"))).toBe("/untitled");
  });
});

describe("checkPageAddress", () => {
  it("normalizes addresses, adding the leading slash", () => {
    expect(checkPageAddress("events/picnic/", pages)).toEqual({ ok: true, path: "/events/picnic" });
  });

  it("refuses invalid, reserved and taken addresses", () => {
    expect(checkPageAddress("/Bad Name", pages)).toEqual({ ok: false, problem: "invalid" });
    expect(checkPageAddress("/admin/x", pages)).toEqual({ ok: false, problem: "reserved" });
    expect(checkPageAddress("/about", pages)).toEqual({ ok: false, problem: "taken" });
  });

  it("allows a page to keep its own address", () => {
    expect(checkPageAddress("/about", pages, "/about")).toEqual({ ok: true, path: "/about" });
  });
});

describe("page file changes", () => {
  it("writes the page's file in canonical form, without Puck's empty zones", () => {
    const change = pageFileChange("/about", { root: { props: { title: "About" } }, content: [], zones: {} });
    expect(change).toEqual({
      path: "content/pages/about.json",
      content:
        '{\n  "version": 1,\n  "data": {\n    "content": [],\n    "root": {\n      "props": {\n        "title": "About"\n      }\n    }\n  }\n}\n',
    });
  });

  it("keeps zones that have content", () => {
    const zones = { "a:b": [{ type: "Text", props: { id: "t" } }] };
    expect(storedData({ root: {}, content: [], zones }).zones).toBe(zones);
  });
});

describe("updateMenuLinks", () => {
  const menus = {
    main: [
      { label: "About", href: "/about", children: [{ label: "Staff", href: "/about/staff" }] },
      { label: "Aboutness", href: "/aboutness" },
    ],
  };

  it("moves links to the page and pages inside it, but not similar addresses", () => {
    expect(updateMenuLinks(menus, "/about", "/who-we-are")).toEqual({
      main: [
        { label: "About", href: "/who-we-are", children: [{ label: "Staff", href: "/who-we-are/staff" }] },
        { label: "Aboutness", href: "/aboutness" },
      ],
    });
  });

  it("reports when nothing changed", () => {
    expect(updateMenuLinks(menus, "/contact", "/get-in-touch")).toBeUndefined();
  });
});

describe("movePageChanges", () => {
  it("deletes the old file, writes the new one and updates menus in one save", () => {
    const changes = movePageChanges(
      page("/about", "About us"),
      "/who-we-are",
      { main: [{ label: "About", href: "/about" }] },
      true,
    );
    expect(changes.map((change) => [change.path, "delete" in change])).toEqual([
      ["content/pages/about.json", true],
      ["content/pages/who-we-are.json", false],
      ["content/menus.json", false],
    ]);
  });

  it("leaves menus alone when asked to", () => {
    const changes = movePageChanges(
      page("/about"),
      "/who-we-are",
      { main: [{ label: "About", href: "/about" }] },
      false,
    );
    expect(changes).toHaveLength(2);
  });
});

describe("settings and CSS changes", () => {
  it("writes site settings with their version", () => {
    const settings = siteSettingsSchema.parse({ version: 1, title: "Holy Name" });
    const change = siteSettingsFileChange(settings);
    expect("content" in change && JSON.parse(change.content)).toMatchObject({ version: 1, title: "Holy Name" });
  });

  it("stores custom CSS with one trailing newline, and deletes the file when it's emptied", () => {
    expect(storedCss("a{}\n\n\n")).toBe("a{}\n");
    expect(storedCss("  \n")).toBe("");
    expect(customCssFileChange("a{}")).toEqual({ path: "content/styles/custom.css", content: "a{}\n" });
    expect(customCssFileChange("")).toEqual({ path: "content/styles/custom.css", delete: true });
  });
});
