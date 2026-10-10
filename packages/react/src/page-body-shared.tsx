import { isAddedPage } from "@goodfellow-cms/core";
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

export interface PageHeaderProps {
  site: SiteContextValue;
  layoutConfig: Config;
  /** The header's (or footer's) Puck data. */
  data: Data;
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
  // Separate, rather than one component around the page, so a layout can put the page between them.
  /** The site's header, for layouts shared by every page, such as Next.js's. */
  function PageHeader({ site, layoutConfig, data }: PageHeaderProps) {
    if (data.content.length === 0) return null;
    return (
      <SiteProvider value={site}>
        <header className="gf-header">
          <Render config={layoutConfig} data={data} metadata={siteMetadata(site)} site={site} />
        </header>
      </SiteProvider>
    );
  }

  /** The site's footer, for layouts shared by every page. */
  function PageFooter({ site, layoutConfig, data }: PageHeaderProps) {
    if (data.content.length === 0) return null;
    return (
      <SiteProvider value={site}>
        <footer className="gf-footer">
          <Render config={layoutConfig} data={data} metadata={siteMetadata(site)} site={site} />
        </footer>
      </SiteProvider>
    );
  }

  /** A page's own content, without the site's header and footer. */
  function PageContent({ site, pageConfig, page }: PageContentProps) {
    const metadata = siteMetadata(site);
    const rootClassName = (page.root.props as Record<string, unknown> | undefined)?.className;
    return (
      <SiteProvider value={site}>
        {/* Search indexes only pages' own content, not their header and footer, "Page not found" or pages blocks add, such as a list's second page. */}
        <main
          className={cx("gf-main", typeof rootClassName === "string" && rootClassName)}
          data-pagefind-body={site.path === "/404" || isAddedPage(site) ? undefined : ""}
        >
          <Render config={pageConfig} data={page} metadata={metadata} site={site} />
        </main>
      </SiteProvider>
    );
  }

  /** A page's visible content: the site header, the page itself and the site footer. */
  function PageBody({ site, pageConfig, layoutConfig, page, header, footer }: PageBodyProps) {
    return (
      <>
        <PageHeader site={site} layoutConfig={layoutConfig} data={header} />
        <PageContent site={site} pageConfig={pageConfig} page={page} />
        <PageFooter site={site} layoutConfig={layoutConfig} data={footer} />
      </>
    );
  }

  return { PageBody, PageHeader, PageContent, PageFooter };
}
