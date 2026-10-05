"use client";

import type { ImageSize } from "@goodfellow/core";
import type { SiteImageProps, SiteLinkProps } from "@goodfellow/react";
import Image from "next/image";
import Link from "next/link";

// A Client Component module, so Server Components can pass these to the browser for Client Components in blocks.

/** A link to one of the site's pages, with Next.js's client-side navigation. Next.js adds the base path. */
export function NextLink(props: SiteLinkProps) {
  return <Link {...props} />;
}

/** One of the site's images, through Next.js's image component. Its address already has the base path. */
export function NextImage({ src, alt, width, height, loading = "eager", ...props }: SiteImageProps & ImageSize) {
  // Loads lazily only when the block asks to, as `<img>` does, so a logo at the top of the page isn't delayed.
  return <Image {...props} src={src} alt={alt} width={width} height={height} loading={loading} />;
}
