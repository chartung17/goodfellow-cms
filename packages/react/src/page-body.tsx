import { Render as PuckRender } from "@puckeditor/core";
import type { ComponentProps } from "react";
import { createPageBody } from "./page-body-shared.js";
import { SiteProvider } from "./site-context.js";

export type { PageBodyProps } from "./page-body-shared.js";
export { siteMetadata } from "./site-types.js";

function Render({ site: _site, ...props }: ComponentProps<typeof PuckRender> & { site: unknown }) {
  return <PuckRender {...props} />;
}

/** A page's visible content: the site header, the page itself and the site footer. */
export const PageBody = createPageBody({ Render, SiteProvider });
