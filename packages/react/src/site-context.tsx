import type { Collection, Entry, Menus, SiteSettings } from "@goodfellow/core";
import { createContext, type ReactNode, useContext } from "react";

/** What every block can know about the site and the page being rendered. */
export interface SiteContextValue {
  settings: SiteSettings;
  menus: Menus;
  /** The URL path of the page being rendered, such as `/about`. */
  path: string;
  /** Every collection, with its entries. */
  collections: Collection[];
  /** The collection whose template is being rendered or edited. */
  collection?: Collection;
  /** The entry being rendered, on an entry's page. */
  entry?: Entry;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({ value, children }: { value: SiteContextValue; children: ReactNode }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

/** Site settings, menus, collections and the current page. Must be used inside a Goodfellow page. */
export function useSite(): SiteContextValue {
  const value = useContext(SiteContext);
  if (!value) {
    throw new Error("useSite() was called outside a Goodfellow page. Render blocks with <PageBody> or <SiteProvider>.");
  }
  return value;
}
