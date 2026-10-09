import { siteSettingsSchema } from "@goodfellow-cms/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteImage, SiteLink } from "./links.js";
import { SiteProvider } from "./site-context.js";
import type { SiteComponents, SiteContextValue } from "./site-types.js";

const site: SiteContextValue = {
  settings: siteSettingsSchema.parse({ version: 1 }),
  menus: {},
  path: "/",
  collections: [],
};

const render = (value: Partial<SiteContextValue>, element: React.ReactNode) =>
  renderToStaticMarkup(<SiteProvider value={{ ...site, ...value }}>{element}</SiteProvider>);

const components: SiteComponents = {
  Link: ({ href, children }) => (
    <a data-router="" href={href}>
      {children}
    </a>
  ),
  Image: ({ src, alt, width, height }) => <img data-sized="" src={src} alt={alt} width={width} height={height} />,
};

describe("SiteLink", () => {
  it("adds the base path to the site's own addresses only", () => {
    expect(render({ base: "/repo/" }, <SiteLink href="/about">About</SiteLink>)).toBe(
      '<a href="/repo/about">About</a>',
    );
    expect(render({ base: "/repo/" }, <SiteLink href="https://example.org">X</SiteLink>)).toBe(
      '<a href="https://example.org">X</a>',
    );
  });

  it("uses the renderer's link component for pages, but not files or new tabs", () => {
    expect(render({ base: "/repo/", components }, <SiteLink href="/about">A</SiteLink>)).toBe(
      '<a data-router="" href="/about">A</a>',
    );
    expect(render({ base: "/repo/", components }, <SiteLink href="/media/a.pdf">B</SiteLink>)).toBe(
      '<a href="/repo/media/a.pdf">B</a>',
    );
    expect(
      render(
        { components },
        <SiteLink href="/about" target="_blank">
          C
        </SiteLink>,
      ),
    ).toBe('<a href="/about" target="_blank">C</a>');
  });
});

describe("SiteImage", () => {
  it("uses the renderer's image component with the image's size, where it's known", () => {
    const media = { "/media/a.png": { width: 40, height: 20 } };
    expect(render({ base: "/repo/", components, media }, <SiteImage src="/media/a.png" alt="A" />)).toContain(
      '<img data-sized="" src="/repo/media/a.png" alt="A" width="40" height="20"/>',
    );
    expect(render({ base: "/repo/", components, media }, <SiteImage src="/media/b.png" alt="B" />)).toContain(
      '<img src="/repo/media/b.png" alt="B"/>',
    );
  });
});
