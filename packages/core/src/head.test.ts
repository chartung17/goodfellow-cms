import { describe, expect, it } from "vitest";
import type { Page } from "./content/load.js";
import { siteSettingsSchema } from "./content/schemas.js";
import { getPageHead } from "./head.js";

const settings = siteSettingsSchema.parse({
  version: 1,
  title: "Holy Name",
  description: "A parish",
  url: "https://example.org/",
  titleTemplate: "%s | Holy Name",
  socialImage: "/media/share.png",
});

const page = (path: string, props: Record<string, unknown>): Page => ({
  path,
  file: "",
  content: { version: 1, data: { root: { props }, content: [] } },
});

describe("getPageHead", () => {
  it("uses the title template for inner pages", () => {
    const head = getPageHead(settings, page("/about", { title: "About us" }));
    expect(head.title).toBe("About us | Holy Name");
    expect(head.description).toBe("A parish");
    expect(head.canonicalUrl).toBe("https://example.org/about");
    expect(head.socialImage).toBe("/media/share.png");
    expect(head.noIndex).toBe(false);
  });

  it("uses the page title as-is on the home page, falling back to the site title", () => {
    expect(getPageHead(settings, page("/", { title: "Welcome" })).title).toBe("Welcome");
    expect(getPageHead(settings, page("/", {})).title).toBe("Holy Name");
    expect(getPageHead(settings, page("/", {})).canonicalUrl).toBe("https://example.org/");
  });

  it("lets pages override the description and image", () => {
    const head = getPageHead(settings, page("/x", { description: "Mine", image: "/media/x.png" }));
    expect(head.description).toBe("Mine");
    expect(head.socialImage).toBe("/media/x.png");
  });

  it("keeps the 404 page out of search results", () => {
    expect(getPageHead(settings, page("/404", {})).noIndex).toBe(true);
  });
});
