import {
  type Collection,
  collectionFileSchema,
  type Page,
  type SiteContent,
  siteSettingsSchema,
} from "@goodfellow/core";
import { createPuckConfig } from "@goodfellow/react";
import { createPageRenderer } from "@goodfellow/react/server";
import { describe, expect, it } from "vitest";
import { blocks, categories, listedEntries } from "./index.js";

const renderPage = createPageRenderer({ blocks, categories });

const events: Collection = {
  id: "events",
  file: "content/collections/events/_collection.json",
  settings: collectionFileSchema.parse({
    version: 1,
    name: "Events",
    entryName: "Event",
    path: "/events/{slug}",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "date", label: "Date", type: "date" },
      { name: "photo", label: "Photo", type: "image" },
      { name: "summary", label: "Summary", type: "textarea" },
      { name: "body", label: "Text", type: "richtext" },
    ],
    sort: { field: "date", order: "asc" },
    template: {
      root: { props: { title: "{title}" } },
      content: [
        { type: "EntryField", props: { id: "t", field: "title", style: "title", className: "" } },
        { type: "EntryField", props: { id: "d", field: "date", style: "small", className: "" } },
        { type: "EntryField", props: { id: "b", field: "body", style: "text", className: "" } },
        { type: "EntryField", props: { id: "p", field: "photo", style: "text", className: "" } },
      ],
    },
  }),
  entries: [
    ["picnic", "Parish picnic", "2026-07-12", "Food & games"],
    ["fish-fry", "Fish fry", "2026-03-06", ""],
    ["undated", "Undated", undefined, ""],
  ].map(([slug, title, date, summary]) => ({
    collection: "events",
    slug: slug as string,
    file: `content/collections/events/${slug}.json`,
    path: `/events/${slug}`,
    content: {
      version: 1,
      fields: {
        title,
        ...(date && { date }),
        summary,
        body: "<p>Join us <script>alert(1)</script></p>",
        ...(slug === "picnic" && { photo: "/media/picnic.jpg" }),
      },
    },
  })),
};

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
  collections: [events],
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

  it("lists a collection's entries as cards linking to their pages", async () => {
    const html = await render([
      {
        type: "CollectionList",
        props: {
          id: "l",
          collection: "events",
          layout: "cards",
          columns: "3",
          imageField: "photo",
          dateField: "date",
          summaryField: "summary",
          order: "newest",
          show: "all",
          limit: 2,
          emptyText: "",
          className: "",
        },
      },
    ]);
    expect(html).toContain('<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">');
    expect(html.indexOf("Parish picnic")).toBeLessThan(html.indexOf("Fish fry"));
    expect(html).not.toContain("Undated");
    expect(html).toContain(
      '<img src="/media/picnic.jpg" alt="" loading="lazy" class="aspect-video w-full object-cover"/>',
    );
    expect(html).toContain('<time dateTime="2026-07-12" class="text-sm text-muted-foreground">July 12, 2026</time>');
    expect(html).toContain(
      '<a href="/events/picnic" class="after:absolute after:inset-0 hover:underline">Parish picnic</a>',
    );
    expect(html).toContain("Food &amp; games");
  });

  it("shows the empty text when nothing matches", async () => {
    const html = await render([
      {
        type: "CollectionList",
        props: {
          id: "l",
          collection: "events",
          layout: "list",
          columns: "3",
          imageField: "",
          dateField: "date",
          summaryField: "",
          order: "default",
          show: "upcoming",
          limit: 0,
          emptyText: "No events planned",
          className: "",
        },
      },
    ]);
    // Every event in the fixture is in the past.
    expect(html).toContain('<p class="text-muted-foreground">No events planned</p>');
  });

  it("filters and orders entries by date", () => {
    const options = { dateField: "date", order: "default", show: "upcoming", limit: 0 } as const;
    expect(listedEntries(events, options, "2026-05-01").map((e) => e.slug)).toEqual(["picnic"]);
    expect(listedEntries(events, { ...options, show: "past" }, "2026-05-01").map((e) => e.slug)).toEqual(["fish-fry"]);
    expect(listedEntries(events, { ...options, show: "all" }).map((e) => e.slug)).toEqual([
      "fish-fry",
      "picnic",
      "undated",
    ]);
    expect(listedEntries(events, { ...options, show: "all", order: "title" }).map((e) => e.slug)).toEqual([
      "fish-fry",
      "picnic",
      "undated",
    ]);
  });

  it("renders an entry's fields in its template, with rich text sanitized", async () => {
    const picnic = events.entries[0];
    const html = await renderPage(content, {
      path: "/events/picnic",
      file: picnic?.file ?? "",
      content: { version: 1, data: events.settings.template },
      entry: { collection: "events", slug: "picnic" },
    });
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    expect(main).toMatch(/<h1 class="text-4xl[^"]*">Parish picnic<\/h1>/);
    expect(main).toContain(
      '<p class="text-sm text-muted-foreground"><time dateTime="2026-07-12">July 12, 2026</time></p>',
    );
    expect(main).toContain("Join us");
    expect(main).not.toContain("<script");
    expect(main).toContain('<img src="/media/picnic.jpg" alt="Parish picnic" class="w-full rounded-lg"/>');
  });

  it("leaves entry fields out of the page editor", () => {
    expect(Object.keys(createPuckConfig({ blocks, categories }, "page").components)).not.toContain("EntryField");
  });
});
