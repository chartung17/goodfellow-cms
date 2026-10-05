import type { Menus, SiteSettings } from "@goodfellow/core";
import { createContext, type ReactNode, useContext } from "react";

/** What every block can know about the site and the page being rendered. */
export interface SiteContextValue {
  settings: SiteSettings;
  menus: Menus;
  /** The URL path of the page being rendered, such as `/about`. */
  path: string;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({ value, children }: { value: SiteContextValue; children: ReactNode }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

/** Site settings, menus and the current page path. Must be used inside a Goodfellow page. */
export function useSite(): SiteContextValue {
  const value = useContext(SiteContext);
  if (!value) {
    throw new Error("useSite() was called outside a Goodfellow page. Render blocks with <PageBody> or <SiteProvider>.");
  }
  return value;
}
