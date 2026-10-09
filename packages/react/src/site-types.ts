import type { Collection, Entry, ImageSize, Menus, SiteSettings } from "@goodfellow-cms/core";
import type { Metadata } from "@puckeditor/core";
import type { AnchorHTMLAttributes, ComponentType, ImgHTMLAttributes } from "react";

export interface SiteLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

export interface SiteImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

/**
 * Components that replace plain links and images, such as Next.js's `next/link`
 * and `next/image`. `<SiteLink>` and `<SiteImage>` use them where they can.
 */
export interface SiteComponents {
  /** Renders links to the site's own pages. Gets the address without the base path. */
  Link?: ComponentType<SiteLinkProps>;
  /** Renders the site's own images whose size is known. Gets the address with the base path. */
  Image?: ComponentType<SiteImageProps & ImageSize>;
}

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
  /**
   * The path the site is served from, such as `/my-site/`, when the renderer
   * leaves adding it to blocks: `<SiteLink>` and `<SiteImage>` add it, and
   * `withBase()` adds it to any other address. Unset when the whole page is
   * rewritten afterwards, as `goodfellow build` does.
   */
  base?: string;
  /** Replacements for plain links and images, such as Next.js's. */
  components?: SiteComponents;
  /** The sizes of the site's images, by address (`/media/photo.jpg`), where they're known. */
  media?: Record<string, ImageSize>;
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
