import { withBase } from "@goodfellow/core";
import type { SiteContextValue, SiteImageProps, SiteLinkProps } from "./site-types.js";

/** Whether a link goes to one of the site's own pages, rather than a file, another site, or a new tab. */
function isPageLink({ href, target, download }: SiteLinkProps): boolean {
  return (
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.startsWith("/media/") &&
    (target === undefined || target === "_self") &&
    download === undefined
  );
}

/** Builds `SiteLink` and `SiteImage` on a `useSite()`: the browser's, or the Server Components' version. */
export function createSiteLinks(useSite: () => SiteContextValue) {
  /**
   * A link. Use it in blocks instead of `<a>`, so links follow the site's base
   * path, and links to the site's own pages use the renderer's link component,
   * such as Next.js's `next/link`.
   */
  function SiteLink(props: SiteLinkProps) {
    const { base, components } = useSite();
    const Link = components?.Link;
    if (Link && isPageLink(props)) return <Link {...props} />;
    return <a {...props} href={withBase(props.href, base)} />;
  }

  /**
   * An image. Use it in blocks instead of `<img>`, so images follow the site's
   * base path, and the site's own images use the renderer's image component,
   * such as Next.js's `next/image`, with their size filled in.
   */
  function SiteImage(props: SiteImageProps) {
    const { base, components, media } = useSite();
    const size = media?.[props.src];
    const src = withBase(props.src, base);
    const Image = components?.Image;
    if (Image && size) {
      const { width: _width, height: _height, ...rest } = props;
      return <Image {...rest} src={src} width={size.width} height={size.height} />;
    }
    // biome-ignore lint/a11y/useAltText: the alt text is in props, which TypeScript requires
    return <img {...props} src={src} />;
  }

  return { SiteLink, SiteImage };
}
