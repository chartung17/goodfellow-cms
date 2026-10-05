import type { Metadata } from "@puckeditor/core";
import { Render as PuckRender } from "@puckeditor/core/rsc";
import type { ComponentProps } from "react";
import { createPageBody } from "./page-body-shared.js";
import { SiteProvider } from "./site-context.server.js";

export type { PageBodyProps } from "./page-body-shared.js";
export { siteMetadata } from "./site-types.js";

/**
 * Puck's server `Render` (0.23) adds `puck.metadata` to a block's props before
 * looking through them for slots, so it mistakes metadata for slot content when
 * a key matches a slot's name, such as an entry's `content` and a Section's
 * `content` slot. Its browser `Render` doesn't. Keeping the objects in
 * metadata non-enumerable hides them from that search, while blocks can still
 * read them as `puck.metadata.entry` and so on.
 */
export function hiddenFromSlots(metadata: Metadata): Metadata {
  const result: Metadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    Object.defineProperty(result, key, {
      value,
      enumerable: value === null || typeof value !== "object",
      configurable: true,
    });
  }
  return result;
}

/** Puck's server `Render`, matching its browser `Render`: that wraps the content in a `<div>`, so the same CSS applies either way. */
function Render({ metadata = {}, ...props }: ComponentProps<typeof PuckRender>) {
  return (
    <div>
      <PuckRender {...props} metadata={hiddenFromSlots(metadata)} />
    </div>
  );
}

/** A page's visible content, rendered as Server Components: the site header, the page itself and the site footer. */
export const PageBody = createPageBody({ Render, SiteProvider });
