import { type GoodfellowConfig, type Page, type SiteContent, siteSettingsSchema } from "@goodfellow/core";
import type { ComponentConfig } from "@puckeditor/core";
import { describe, expect, it } from "vitest";
import { createPageRenderer } from "./server.js";
import { useSite } from "./site-context.js";

function CurrentPath() {
  const { path, settings } = useSite();
  return (
    <span>
      {settings.title} at {path}
    </span>
  );
}

const resolved: ComponentConfig<{ text: string }> = {
  fields: { text: { type: "text" } },
  resolveData: async ({ props }) => ({ props: { ...props, text: `resolved ${props.text}` } }),
  render: ({ text }) => <p>{text}</p>,
};

const config: GoodfellowConfig = {
  blocks: {
    Heading: {
      fields: { text: { type: "text" } },
      render: ({ text }) => <h1>{text}</h1>,
    },
    Body: {
      fields: { body: { type: "richtext" } },
      render: ({ body }) => <div className="body">{body}</div>,
    },
    Where: { render: () => <CurrentPath /> },
    Resolved: resolved,
  },
};

const settings = siteSettingsSchema.parse({
  version: 1,
  title: "Holy Name",
  url: "https://example.org",
  titleTemplate: "%s | Holy Name",
  socialImage: "/media/share.png",
  theme: { colors: { primary: "#1e3a8a" }, fonts: { heading: "Cinzel" } },
});

function makeContent(overrides: Partial<SiteContent> = {}): SiteContent {
  return {
    settings,
    menus: {},
    header: { version: 1, data: { root: {}, content: [] } },
    footer: { version: 1, data: { root: {}, content: [] } },
    pages: [],
    customCss: "",
    ...overrides,
  };
}

function makePage(content: unknown[], rootProps: Record<string, unknown> = {}, path = "/about"): Page {
  return {
    path,
    file: "content/pages/about.json",
    content: {
      version: 1,
      data: { root: { props: rootProps }, content: content as Page["content"]["data"]["content"] },
    },
  };
}

const renderPage = createPageRenderer(config);

describe("renderPage", () => {
  it("renders a complete document with head tags and theme", async () => {
    const html = await renderPage(
      makeContent(),
      makePage([{ type: "Heading", props: { id: "h", text: "About us" } }], {
        title: "About",
        className: "page-about",
      }),
      { stylesheets: ["/assets/site.css"] },
    );

    expect(html.startsWith('<!DOCTYPE html><html lang="en">')).toBe(true);
    expect(html).toContain("<title>About | Holy Name</title>");
    expect(html).toContain('<link rel="canonical" href="https://example.org/about"/>');
    expect(html).toContain('<meta property="og:image" content="https://example.org/media/share.png"/>');
    expect(html).toContain('<link rel="stylesheet" href="/assets/site.css"/>');
    expect(html).toContain("family=Cinzel:wght@");
    expect(html).toContain("--primary:#1e3a8a");
    expect(html).toContain('<main class="gf-main page-about"><div><h1>About us</h1></div></main>');
    expect(html).not.toContain("<header");
  });

  it("renders the header and footer around the page", async () => {
    const html = await renderPage(
      makeContent({
        header: { version: 1, data: { root: {}, content: [{ type: "Where", props: { id: "w" } }] } },
        footer: { version: 1, data: { root: {}, content: [{ type: "Heading", props: { id: "f", text: "Bye" } }] } },
      }),
      makePage([]),
    );
    expect(html).toMatch(
      /<header class="gf-header"><div><span>Holy Name<!-- --> at <!-- -->\/about<\/span><\/div><\/header><main/,
    );
    expect(html).toContain('<footer class="gf-footer"><div><h1>Bye</h1></div></footer>');
  });

  it("wraps blocks in their CSS classes only when set", async () => {
    const html = await renderPage(
      makeContent(),
      makePage([
        { type: "Heading", props: { id: "a", text: "Plain" } },
        { type: "Heading", props: { id: "b", text: "Styled", className: "text-center mt-4" } },
      ]),
    );
    expect(html).toContain(
      '<main class="gf-main"><div><h1>Plain</h1><div class="text-center mt-4"><h1>Styled</h1></div></div></main>',
    );
  });

  it("runs resolveData before rendering", async () => {
    const html = await renderPage(makeContent(), makePage([{ type: "Resolved", props: { id: "r", text: "text" } }]));
    expect(html).toContain("<p>resolved text</p>");
  });

  it("renders rich text without scripts, event handlers or javascript: links", async () => {
    const body =
      '<p onclick="steal()">Hello <strong>world</strong><script>alert(1)</script></p>' +
      '<p><a href="javascript:alert(1)">bad</a> <a href="/about">good</a></p><img src=x onerror=alert(1)>';
    const html = await renderPage(makeContent(), makePage([{ type: "Body", props: { id: "b", body } }]));

    expect(html).toContain("Hello <strong>world</strong>");
    expect(html).toContain('href="/about"');
    expect(html).not.toMatch(/<script|onclick|onerror|javascript:/i);
  });
});
