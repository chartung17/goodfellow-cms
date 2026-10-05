import { cache, type ReactNode } from "react";
import type { SiteContextValue } from "./site-types.js";

export type { SiteContextValue } from "./site-types.js";

/**
 * Server Components have no context, so the site is kept in React's
 * per-request cache instead: each page rendered on the server gets its own.
 */
const current = cache((): { value: SiteContextValue | null } => ({ value: null }));

export function SiteProvider({ value, children }: { value: SiteContextValue; children: ReactNode }) {
  current().value = value;
  return children;
}

/** Site settings, menus, collections and the current page. Must be used inside a Goodfellow page. */
export function useSite(): SiteContextValue {
  const { value } = current();
  if (!value) {
    throw new Error("useSite() was called outside a Goodfellow page. Render blocks with <PageBody> or <SiteProvider>.");
  }
  return value;
}
