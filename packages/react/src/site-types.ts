import type { Collection, Entry, Menus, SiteSettings } from "@goodfellow/core";
import type { Metadata } from "@puckeditor/core";

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

/** The Puck metadata every block receives, mirroring `useSite()`. */
export function siteMetadata(site: SiteContextValue): Metadata {
  return {
    site: site.settings,
    menus: site.menus,
    path: site.path,
    collections: site.collections,
    collection: site.collection,
    entry: site.entry,
  };
}
