import { resolve } from "node:path";
import { allPages, loadSiteContent } from "@goodfellow/core";
import { fileSystemSource } from "@goodfellow/core/node";
import { describe, expect, it } from "vitest";
import { goodfellowPages, pageMetadata } from "./index.js";

const root = resolve(import.meta.dirname, "../../../templates/starter");
const site = goodfellowPages({ blocks: {} }, { root });

describe("goodfellowPages", () => {
  it("lists every page but 'not found' for Next.js to build, the home page as no segments", async () => {
    const params = await site.generateStaticParams();
    expect(params).toContainEqual({ path: [] });
    expect(params).toContainEqual({ path: ["news", "welcome"] });
    expect(params).not.toContainEqual({ path: ["404"] });
  });

  it("gives entries' pages their own titles", async () => {
    const metadata = await site.generateMetadata({ params: Promise.resolve({ path: ["news", "welcome"] }) });
    expect(metadata.title).toEqual({ absolute: "Welcome to our new website | My site" });
  });

  it("only writes a sitemap once the site's address is known", async () => {
    expect(await site.sitemap()).toEqual([]);
    expect(await site.robots()).toEqual({ rules: { userAgent: "*", allow: "/" } });
  });
});

describe("pageMetadata", () => {
  it("makes addresses absolute from the site's address", async () => {
    const content = await loadSiteContent(fileSystemSource(root));
    const withUrl = {
      ...content,
      settings: { ...content.settings, url: "https://example.org", socialImage: "/media/a.png" },
    };
    const about = allPages(withUrl).find((page) => page.path === "/about");
    if (!about) throw new Error("The starter has no about page.");
    const metadata = pageMetadata(withUrl, about);
    expect(metadata.alternates).toEqual({ canonical: "https://example.org/about" });
    expect(metadata.openGraph).toMatchObject({ images: ["https://example.org/media/a.png"] });
    expect(metadata.metadataBase).toEqual(new URL("https://example.org"));
  });
});
