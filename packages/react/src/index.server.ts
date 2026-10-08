// What Server Components (the "react-server" condition) get: the same API, without React context.

/** HTML that's safe to put in a page, for blocks that show HTML someone wrote: see `@goodfellow/core`. */
export { sanitizeHtml } from "@goodfellow/core";
export { BodyCode, HeadCode } from "./custom-code.js";
export { cx } from "./cx.js";
export { applyEntry, placeholderValues } from "./entry.js";
export { SiteImage, SiteLink } from "./links.server.js";
export {
  PageBody,
  type PageBodyProps,
  PageContent,
  type PageContentProps,
  PageFooter,
  PageHeader,
  type PageHeaderProps,
  siteMetadata,
} from "./page-body.server.js";
export {
  applyPageEntry,
  createPuckConfigs,
  type PreparedLayout,
  type PreparedPage,
  type PuckConfigs,
  prepareLayout,
  preparePage,
  type RenderOptions,
} from "./prepare.js";
export {
  classNameField,
  createPuckConfig,
  isTemplateOnly,
  type MediaFieldKind,
  mediaField,
  mediaFieldKind,
  type PuckConfigKind,
  templateOnly,
  withClassName,
} from "./puck-config.js";
export { type SiteContextValue, SiteProvider, useSite } from "./site-context.server.js";
export type { SiteComponents, SiteImageProps, SiteLinkProps } from "./site-types.js";
