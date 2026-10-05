import {
  absoluteUrl,
  allPages,
  type GoodfellowConfig,
  getPageHead,
  googleFontsUrl,
  loadSiteContent,
  normalizePagePath,
  type Page,
  type SiteContent,
  themeToCss,
} from "@goodfellow/core";
import { fileSystemSource } from "@goodfellow/core/node";
import { applyPageEntry, createPuckConfigs, PageBody, preparePage } from "@goodfellow/react";
import type { Metadata, MetadataRoute } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

export interface GoodfellowPagesOptions {
  /** The site's folder, holding `content/`. Defaults to the folder Next.js runs in. */
  root?: string;
}

/** The route parameters of an optional catch-all route named `[[...path]]`. */
export interface PageProps {
  params: Promise<{ path?: string[] }>;
}

/**
 * Reads the site's content from disk. Cached for the length of one request, so
 * a page and its metadata read it once, and content edits show on reload in development.
 */
export const loadSite = cache(
  (root: string = process.cwd()): Promise<SiteContent> => loadSiteContent(fileSystemSource(root)),
);

function pathOf(segments: string[] | undefined): string {
  try {
    return normalizePagePath(`/${(segments ?? []).map((segment) => decodeURIComponent(segment)).join("/")}`);
  } catch {
    return "";
  }
}

function findPage(content: SiteContent, path: string): Page | undefined {
  return allPages(content).find((page) => page.path === path);
}

function toAbsolute(siteUrl: string | undefined, url: string | undefined): string | undefined {
  if (!url || !siteUrl || !url.startsWith("/") || url.startsWith("//")) return url;
  return absoluteUrl(siteUrl, url);
}

/** A page's title, description and link previews, as Next.js metadata. */
export function pageMetadata(content: SiteContent, page: Page): Metadata {
  const head = getPageHead(content.settings, page);
  const socialImage = toAbsolute(content.settings.url, head.socialImage);
  return {
    ...(content.settings.url && { metadataBase: new URL(content.settings.url) }),
    title: { absolute: head.title },
    ...(head.description && { description: head.description }),
    ...(head.noIndex && { robots: { index: false } }),
    ...(head.canonicalUrl && { alternates: { canonical: head.canonicalUrl } }),
    ...(head.favicon && { icons: { icon: head.favicon } }),
    openGraph: {
      type: "website",
      title: head.title,
      ...(head.description && { description: head.description }),
      ...(head.canonicalUrl && { url: head.canonicalUrl }),
      // Link previews need a full address, which needs the site's address.
      ...(socialImage && /^https?:\/\//.test(socialImage) && { images: [socialImage] }),
    },
  };
}

/**
 * Renders the site's pages in a Next.js App Router site, as Server Components:
 * the HTML is the same as `goodfellow build` writes, with no JavaScript for the
 * blocks. Use the results in `app/[[...path]]/page.tsx` and `app/not-found.tsx`.
 */
export function goodfellowPages(config: GoodfellowConfig, options: GoodfellowPagesOptions = {}) {
  const configs = createPuckConfigs(config);
  const site = () => loadSite(options.root);

  async function render(content: SiteContent, page: Page) {
    const prepared = await preparePage(configs, content, page);
    const fontsUrl = googleFontsUrl(content.settings.theme);
    return (
      <>
        {/* React moves these into the document's head. themeToCss escapes its output. */}
        <style href="goodfellow-theme" precedence="default">
          {themeToCss(content.settings.theme)}
        </style>
        {fontsUrl && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link rel="stylesheet" href={fontsUrl} precedence="default" />
          </>
        )}
        <PageBody
          site={prepared.site}
          pageConfig={prepared.pageConfig}
          layoutConfig={prepared.layoutConfig}
          page={prepared.data}
          header={prepared.header}
          footer={prepared.footer}
        />
      </>
    );
  }

  return {
    /** Every page's address, so Next.js builds them all. Any other address is "not found". */
    async generateStaticParams(): Promise<Array<{ path: string[] }>> {
      return allPages(await site())
        .filter((page) => page.path !== "/404")
        .map((page) => ({ path: page.path === "/" ? [] : page.path.slice(1).split("/") }));
    },

    async generateMetadata({ params }: PageProps): Promise<Metadata> {
      const content = await site();
      const page = findPage(content, pathOf((await params).path));
      return page ? pageMetadata(content, applyPageEntry(configs, content, page)) : {};
    },

    /** The page at the route's address: its header, content and footer. */
    async Page({ params }: PageProps) {
      const content = await site();
      const page = findPage(content, pathOf((await params).path));
      if (!page || page.path === "/404") notFound();
      return render(content, page);
    },

    /** The site's "Page not found" page (`content/pages/404.json`), for `app/not-found.tsx`. */
    async NotFound() {
      const content = await site();
      const page = findPage(content, "/404");
      return (
        <>
          {/* Next.js doesn't take metadata from not-found pages; React moves this into the head. */}
          <title>{page ? getPageHead(content.settings, page).title : "Page not found"}</title>
          {page ? render(content, page) : <h1>Page not found</h1>}
        </>
      );
    },

    /** For `app/sitemap.ts`: every page but "Page not found", once the site's address is set. */
    async sitemap(): Promise<MetadataRoute.Sitemap> {
      const content = await site();
      const url = content.settings.url;
      if (!url) return [];
      return allPages(content)
        .filter((page) => page.path !== "/404")
        .map((page) => ({ url: absoluteUrl(url, page.path) }));
    },

    /** For `app/robots.ts`: lets search engines in, and points them at the sitemap once the site's address is set. */
    async robots(): Promise<MetadataRoute.Robots> {
      const url = (await site()).settings.url;
      return { rules: { userAgent: "*", allow: "/" }, ...(url && { sitemap: absoluteUrl(url, "/sitemap.xml") }) };
    },
  };
}
