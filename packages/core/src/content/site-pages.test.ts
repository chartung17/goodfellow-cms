import { describe, expect, it } from "vitest";
import { type ContentSource, loadSiteContent } from "./load.js";
import { blockPages, isAddedPage, sitePages, variantPath, withPages } from "./site-pages.js";

function memorySource(files: Record<string, unknown>): ContentSource {
  const text = Object.fromEntries(Object.entries(files).map(([path, value]) => [path, JSON.stringify(value)]));
  return {
    read: async (path) => text[path],
    list: async (dir) => Object.keys(text).filter((path) => path.startsWith(`${dir}/`)),
  };
}

const page = (title: string, content: unknown[] = []) => ({
  version: 1,
  data: { root: { props: { title } }, content },
});
const block = (type: string, id: string, props: Record<string, unknown> = {}) => ({ type, props: { id, ...props } });

/** A block that adds a page for each of the next few days, as a calendar's months are added. */
const Days = withPages({ render: () => null }, (props: { days?: number }, { today }) =>
  Array.from({ length: props.days ?? 0 }, (_, index) => ({
    suffix: `day-${index + 1}`,
    title: `${today}, day ${index + 1}`,
  })),
);
const blocks = { Days, Section: { render: () => null } };

describe("pages blocks add", () => {
  it("are added to the page the first block that adds any is on, without taking an address", async () => {
    const content = await loadSiteContent(
      memorySource({
        "content/pages/index.json": page("Home"),
        "content/pages/plan.json": page("Plan", [
          block("Days", "Days-0"),
          block("Section", "Section-1", { content: [block("Days", "Days-1", { days: 3 })] }),
          block("Days", "Days-2", { days: 5 }),
        ]),
        "content/pages/plan/day-2.json": page("A page of its own"),
      }),
    );
    const pages = sitePages(content, "2026-10-10", blocks);
    expect(pages.map(({ path, view }) => [path, view?.block, view?.title])).toEqual([
      ["/", undefined, undefined],
      ["/plan", "Days-1", undefined],
      ["/plan/day-1", "Days-1", "2026-10-10, day 1"],
      // A page's own address comes first.
      ["/plan/day-2", undefined, undefined],
      ["/plan/day-3", "Days-1", "2026-10-10, day 3"],
    ]);
    const added = pages.find(({ path }) => path === "/plan/day-3");
    expect(added).toMatchObject({ file: "content/pages/plan.json", view: { path: "/plan" } });
    expect(added && isAddedPage(added)).toBe(true);
    expect(isAddedPage(pages[1] ?? { path: "" })).toBe(false);
  });

  it("are found from the blocks that add them", () => {
    expect(blockPages(Days)).toBeTypeOf("function");
    expect(blockPages(blocks.Section)).toBeUndefined();
    expect(variantPath("/", "page/2")).toBe("/page/2");
    expect(variantPath("/news", "page/2")).toBe("/news/page/2");
  });
});
