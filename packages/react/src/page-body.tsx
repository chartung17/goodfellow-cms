import { type Config, type Data, type Metadata, Render } from "@puckeditor/core";
import { cx } from "./cx.js";
import { type SiteContextValue, SiteProvider } from "./site-context.js";

export interface PageBodyProps {
  site: SiteContextValue;
  pageConfig: Config;
  layoutConfig: Config;
  page: Data;
  header: Data;
  footer: Data;
}

/** The Puck metadata every block receives, mirroring `useSite()`. */
export function siteMetadata(site: SiteContextValue): Metadata {
  return { site: site.settings, menus: site.menus, path: site.path };
}

/** A page's visible content: the site header, the page itself and the site footer. */
export function PageBody({ site, pageConfig, layoutConfig, page, header, footer }: PageBodyProps) {
  const metadata = siteMetadata(site);
  const rootClassName = (page.root.props as Record<string, unknown> | undefined)?.className;

  return (
    <SiteProvider value={site}>
      {header.content.length > 0 && (
        <header className="gf-header">
          <Render config={layoutConfig} data={header} metadata={metadata} />
        </header>
      )}
      <main className={cx("gf-main", typeof rootClassName === "string" && rootClassName)}>
        <Render config={pageConfig} data={page} metadata={metadata} />
      </main>
      {footer.content.length > 0 && (
        <footer className="gf-footer">
          <Render config={layoutConfig} data={footer} metadata={metadata} />
        </footer>
      )}
    </SiteProvider>
  );
}
