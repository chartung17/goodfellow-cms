import { Render } from "@puckeditor/core";
import { createPageBody } from "./page-body-shared.js";
import { SiteProvider } from "./site-context.js";

export type { PageBodyProps } from "./page-body-shared.js";
export { siteMetadata } from "./site-types.js";

/** A page's visible content: the site header, the page itself and the site footer. */
export const PageBody = createPageBody({ Render, SiteProvider });
