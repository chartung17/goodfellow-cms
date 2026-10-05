import {
  absoluteUrl,
  type GoodfellowConfig,
  getPageHead,
  googleFontsUrl,
  type Page,
  type SiteContent,
  themeToCss,
} from "@goodfellow/core";
import { prerender } from "react-dom/static";
import { PageBody } from "./page-body.js";
import { createPuckConfigs, preparePage } from "./prepare.js";

export interface PageAssets {
  /** Stylesheet URLs, in order. */
  stylesheets?: string[];
  /** Module script URLs, in order. */
  scripts?: string[];
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
  const configs = createPuckConfigs(config);

  return async function renderPage(content: SiteContent, page: Page, assets: PageAssets = {}): Promise<string> {
    const { settings } = content;
    const prepared = await preparePage(configs, content, page);
    page = prepared.page;

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
            site={prepared.site}
            pageConfig={prepared.pageConfig}
            layoutConfig={prepared.layoutConfig}
            page={prepared.data}
            header={prepared.header}
            footer={prepared.footer}
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
