import type { Config, Data, Metadata } from "@puckeditor/core";
import type { ComponentType, ReactNode } from "react";
import { cx } from "./cx.js";
import { type SiteContextValue, siteMetadata } from "./site-types.js";

export interface PageBodyProps {
  site: SiteContextValue;
  pageConfig: Config;
  layoutConfig: Config;
  page: Data;
  header: Data;
  footer: Data;
}

interface Renderers {
  /** Puck's `Render`, which also gets the site the data belongs to. */
  Render: ComponentType<{ config: Config; data: Data; metadata?: Metadata; site: SiteContextValue }>;
  SiteProvider: ComponentType<{ value: SiteContextValue; children: ReactNode }>;
}

/** Builds `PageBody` from Puck's renderer and a site provider: the browser's, or the Server Components' versions. */
export function createPageBody({ Render, SiteProvider }: Renderers) {
  /** A page's visible content: the site header, the page itself and the site footer. */
  return function PageBody({ site, pageConfig, layoutConfig, page, header, footer }: PageBodyProps) {
    const metadata = siteMetadata(site);
    const rootClassName = (page.root.props as Record<string, unknown> | undefined)?.className;

    return (
      <SiteProvider value={site}>
        {header.content.length > 0 && (
          <header className="gf-header">
            <Render config={layoutConfig} data={header} metadata={metadata} site={site} />
          </header>
        )}
        {/* Search indexes only pages' own content, not their header and footer, and not "Page not found". */}
        <main
          className={cx("gf-main", typeof rootClassName === "string" && rootClassName)}
          data-pagefind-body={site.path === "/404" ? undefined : ""}
        >
          <Render config={pageConfig} data={page} metadata={metadata} site={site} />
        </main>
        {footer.content.length > 0 && (
          <footer className="gf-footer">
            <Render config={layoutConfig} data={footer} metadata={metadata} site={site} />
          </footer>
        )}
      </SiteProvider>
    );
  };
}
