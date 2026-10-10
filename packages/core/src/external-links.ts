/** What a link that opens in a new tab gets: `noopener` so the new page can't control this one. */
export const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * Whether a link goes to another site: an `http` or `https` address that isn't
 * on the site's own address (`siteUrl`, such as `https://example.org`).
 * Root-relative links, `mailto:` and `tel:` links are the site's own or open an app.
 */
export function isExternalLink(href: string, siteUrl?: string): boolean {
  if (!/^https?:\/\//i.test(href.trim())) return false;
  if (!siteUrl) return true;
  try {
    return new URL(href.trim()).origin !== new URL(siteUrl).origin;
  } catch {
    return true;
  }
}

export interface LinkTargetOptions {
  /** Whether links to other sites open in a new tab. */
  newTab: boolean;
  /** The site's own address, whose links are never other sites'. */
  siteUrl?: string;
}

/**
 * Says where each link in rendered HTML, such as rich text, opens: links to
 * other sites in a new tab if `newTab` is set, and every other link in the same
 * tab. Puck's rich text would otherwise open every link in a new tab, marked
 * `nofollow`, including links to the site's own pages. Links that already say
 * where they open are left as they are.
 */
export function setLinkTargets(html: string, { newTab, siteUrl }: LinkTargetOptions): string {
  return html.replace(/<a\s[^>]*>/gi, (tag) => {
    const href = /\shref="([^"]*)"/i.exec(tag)?.[1];
    if (href === undefined || /\starget=/i.test(tag)) return tag;
    const external = newTab && isExternalLink(decodeEntities(href), siteUrl);
    const rel = /\srel=/i.test(tag) ? "" : ` rel="${external ? NEW_TAB.rel : ""}"`;
    return `${tag.slice(0, -1)} target="${external ? NEW_TAB.target : "_self"}"${rel}>`;
  });
}

function decodeEntities(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&#x2F;|&#47;/gi, "/");
}
