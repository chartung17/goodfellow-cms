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

export interface PageLayoutProps {
  site: SiteContextValue;
  layoutConfig: Config;
  header: Data;
  footer: Data;
  /** The page's content, between the header and footer: a `<PageContent>`. */
  children: ReactNode;
}

export interface PageContentProps {
  site: SiteContextValue;
  pageConfig: Config;
  page: Data;
}

interface Renderers {
  /** Puck's `Render`, which also gets the site the data belongs to. */
  Render: ComponentType<{ config: Config; data: Data; metadata?: Metadata; site: SiteContextValue }>;
  SiteProvider: ComponentType<{ value: SiteContextValue; children: ReactNode }>;
}

/**
 * Builds the components that render pages from Puck's renderer and a site
 * provider: the browser's, or the Server Components' versions.
 */
export function createPageBody({ Render, SiteProvider }: Renderers) {
  /** The site's header and footer, around a page's content. */
  function PageLayout({ site, layoutConfig, header, footer, children }: PageLayoutProps) {
    const metadata = siteMetadata(site);
    return (
      <SiteProvider value={site}>
        {header.content.length > 0 && (
          <header className="gf-header">
            <Render config={layoutConfig} data={header} metadata={metadata} site={site} />
          </header>
        )}
        {children}
        {footer.content.length > 0 && (
          <footer className="gf-footer">
            <Render config={layoutConfig} data={footer} metadata={metadata} site={site} />
          </footer>
        )}
      </SiteProvider>
    );
  }

  /** A page's own content, without the site's header and footer. */
  function PageContent({ site, pageConfig, page }: PageContentProps) {
    const metadata = siteMetadata(site);
    const rootClassName = (page.root.props as Record<string, unknown> | undefined)?.className;
    return (
      <SiteProvider value={site}>
        {/* Search indexes only pages' own content, not their header and footer, and not "Page not found". */}
        <main
          className={cx("gf-main", typeof rootClassName === "string" && rootClassName)}
          data-pagefind-body={site.path === "/404" ? undefined : ""}
        >
          <Render config={pageConfig} data={page} metadata={metadata} site={site} />
        </main>
      </SiteProvider>
    );
  }

  /** A page's visible content: the site header, the page itself and the site footer. */
  function PageBody({ site, pageConfig, layoutConfig, page, header, footer }: PageBodyProps) {
    return (
      <PageLayout site={site} layoutConfig={layoutConfig} header={header} footer={footer}>
        <PageContent site={site} pageConfig={pageConfig} page={page} />
      </PageLayout>
    );
  }

  return { PageBody, PageLayout, PageContent };
}
