import { type Page, type SiteContent, siteSettingsSchema } from "@goodfellow/core";
import { createPageRenderer } from "@goodfellow/react/server";
import { describe, expect, it } from "vitest";
import { blocks, categories } from "./index.js";

const renderPage = createPageRenderer({ blocks, categories });

const content: SiteContent = {
  settings: siteSettingsSchema.parse({ version: 1, title: "Holy Name", logo: { src: "/media/logo.svg", alt: "Logo" } }),
  menus: {
    main: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about", children: [{ label: "Staff", href: "/about/staff" }] },
    ],
  },
  header: { version: 1, data: { root: {}, content: [] } },
  footer: { version: 1, data: { root: {}, content: [] } },
  pages: [],
  customCss: "",
};

function render(blocksData: unknown[], path = "/about/staff") {
  const page = {
    path,
    file: "",
    content: { version: 1, data: { root: { props: {} }, content: blocksData } },
  } as Page;
  return renderPage(content, page).then((html) => html.slice(html.indexOf("<main"), html.indexOf("</main>")));
}

describe("built-in blocks", () => {
  it("lists every block in a category", () => {
    const categorized = Object.values(categories).flatMap((category) => category.components);
    expect(categorized.sort()).toEqual(Object.keys(blocks).sort());
  });

  it("renders a section with nested columns and applies CSS classes to the block itself", async () => {
    const html = await render([
      {
        type: "Section",
        props: {
          id: "s",
          width: "narrow",
          padding: "lg",
          background: "primary",
          backgroundImage: "",
          className: "hero",
          content: [
            {
              type: "Grid",
              props: {
                id: "g",
                columns: "3",
                gap: "sm",
                className: "",
                items: [
                  {
                    type: "Heading",
                    props: { id: "h", text: "Hi", level: "h1", align: "center", className: "text-red-500" },
                  },
                ],
              },
            },
          ],
        },
      },
    ]);

    expect(html).toContain('<section class="py-20 bg-primary text-primary-foreground hero">');
    expect(html).toContain('class="mx-auto px-4 max-w-2xl"');
    expect(html).toContain('class="grid grid-cols-1 md:grid-cols-3 gap-3"');
    expect(html).toMatch(/<h1 class="[^"]*text-center text-red-500">Hi<\/h1>/);
    expect(html).not.toContain('<div class="hero"');
  });

  it("renders a menu from site data and marks the current page", async () => {
    const html = await render([
      { type: "Menu", props: { id: "m", menu: "main", orientation: "horizontal", className: "" } },
    ]);
    expect(html).toContain('<nav aria-label="main">');
    expect(html).toMatch(/href="\/about" class="[^"]*font-semibold"/);
    expect(html).toContain(
      'href="/about/staff" class="block rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground" aria-current="page"',
    );
    expect(html).not.toMatch(/href="\/" class="[^"]*font-semibold"/);
  });

  it("renders nothing for a menu that doesn't exist", async () => {
    const html = await render([
      { type: "Menu", props: { id: "m", menu: "missing", orientation: "horizontal", className: "" } },
    ]);
    expect(html).not.toContain("<nav");
  });

  it("shows the site logo and name", async () => {
    const html = await render([{ type: "SiteBrand", props: { id: "b", show: "both", className: "" } }]);
    expect(html).toContain('<img src="/media/logo.svg" alt="" class="h-10 w-auto"/><span>Holy Name</span>');
  });

  it("opens buttons in a new tab safely", async () => {
    const html = await render([
      {
        type: "Button",
        props: {
          id: "b",
          label: "Give",
          href: "https://example.org",
          variant: "primary",
          size: "md",
          newTab: true,
          className: "",
        },
      },
    ]);
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
  });
});
