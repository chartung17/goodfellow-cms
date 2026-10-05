import { describe, expect, it } from "vitest";
import { pageEditorHref, parseHash } from "./router.js";

describe("parseHash", () => {
  it("splits the route into segments and query parameters", () => {
    const route = parseHash(pageEditorHref("/about/team"));
    expect(route.segments).toEqual(["pages", "edit"]);
    expect(route.params.get("path")).toBe("/about/team");
  });

  it("treats an empty hash as the start screen", () => {
    expect(parseHash("").segments).toEqual([]);
    expect(parseHash("#/").segments).toEqual([]);
  });
});
