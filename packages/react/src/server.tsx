import {
  absoluteUrl,
  type GoodfellowConfig,
  getPageHead,
  googleFontsUrl,
  type Page,
  type SiteContent,
  themeToCss,
} from "@goodfellow/core";
import { type Config, type Data, type Metadata, migrate, resolveAllData } from "@puckeditor/core";
import { prerender } from "react-dom/static";
import { PageBody, siteMetadata } from "./page-body.js";
import { createPuckConfig } from "./puck-config.js";
import type { SiteContextValue } from "./site-context.js";

export interface PageAssets {
  /** Stylesheet URLs, in order. */
  stylesheets?: string[];
  /** Module script URLs, in order. */
  scripts?: string[];
}

/**
 * Brings stored Puck data up to date with the installed Puck version, then runs
 * every block's `resolveData`, so blocks can fetch or compute content at build time.
 */
async function prepareData(data: unknown, config: Config, metadata: Metadata): Promise<Data> {
  const stored = data as Data;
  // Puck's DropZone-to-slot migration needs the config and logs on every call, so only run it on data that has zones.
  const migrated = migrate(stored, stored.zones && Object.keys(stored.zones).length > 0 ? config : undefined);
  return resolveAllData(migrated, config, metadata);
}

function toAbsolute(siteUrl: string | undefined, url: string | undefined): string | undefined {
  if (!url || !siteUrl || !url.startsWith("/") || url.startsWith("//")) return url;
  return absoluteUrl(siteUrl, url);
}

/**
 * Creates a function that renders pages of a site to complete HTML documents.
 * Rendering waits for everything (including lazily loaded rich text), so the
 * output is final static HTML with no client-side JavaScript required.
 */
export function createPageRenderer(config: GoodfellowConfig) {
  const pageConfig = createPuckConfig(config, "page");
  const layoutConfig = createPuckConfig(config, "layout");

  return async function renderPage(content: SiteContent, page: Page, assets: PageAssets = {}): Promise<string> {
    const { settings } = content;
    const site: SiteContextValue = { settings, menus: content.menus, path: page.path };
    const metadata = siteMetadata(site);
    const [pageData, header, footer] = await Promise.all([
      prepareData(page.content.data, pageConfig, metadata),
      prepareData(content.header.data, layoutConfig, metadata),
      prepareData(content.footer.data, layoutConfig, metadata),
    ]);

    const head = getPageHead(settings, page);
    const fontsUrl = googleFontsUrl(settings.theme);
    const socialImage = toAbsolute(settings.url, head.socialImage);

    const document = (
      <html lang={head.language}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{head.title}</title>
          {head.description && <meta name="description" content={head.description} />}
          {head.noIndex && <meta name="robots" content="noindex" />}
          {head.canonicalUrl && <link rel="canonical" href={head.canonicalUrl} />}
          {head.favicon && <link rel="icon" href={head.favicon} />}
          <meta property="og:type" content="website" />
          <meta property="og:title" content={head.title} />
          {head.description && <meta property="og:description" content={head.description} />}
          {head.canonicalUrl && <meta property="og:url" content={head.canonicalUrl} />}
          {socialImage && <meta property="og:image" content={socialImage} />}
          {fontsUrl && (
            <>
              <link rel="preconnect" href="https://fonts.googleapis.com" />
              <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
              <link rel="stylesheet" href={fontsUrl} />
            </>
          )}
          {assets.stylesheets?.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: themeToCss escapes its output */}
          <style dangerouslySetInnerHTML={{ __html: themeToCss(settings.theme) }} />
        </head>
        <body>
          <PageBody
            site={site}
            pageConfig={pageConfig}
            layoutConfig={layoutConfig}
            page={pageData}
            header={header}
            footer={footer}
          />
          {assets.scripts?.map((src) => (
            <script key={src} type="module" src={src} />
          ))}
        </body>
      </html>
    );

    const { prelude } = await prerender(document);
    // React writes the doctype itself when the root element is <html>.
    return new Response(prelude).text();
  };
}

export type PageRenderer = ReturnType<typeof createPageRenderer>;
