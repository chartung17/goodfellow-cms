import { Render as PuckRender } from "@puckeditor/core";
import type { ComponentProps } from "react";
import { createPageBody } from "./page-body-shared.js";
import { SiteProvider } from "./site-context.js";

export type { PageBodyProps, PageContentProps, PageLayoutProps } from "./page-body-shared.js";
export { siteMetadata } from "./site-types.js";

function Render({ site: _site, ...props }: ComponentProps<typeof PuckRender> & { site: unknown }) {
  return <PuckRender {...props} />;
}

/**
 * Pages: `PageBody` is the site header, the page itself and the site footer;
 * `PageLayout` and `PageContent` are the two parts.
 */
export const { PageBody, PageLayout, PageContent } = createPageBody({ Render, SiteProvider });
