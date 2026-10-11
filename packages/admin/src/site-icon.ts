import type { MediaPreviews } from "./media-previews.js";

/**
 * Shows the site's icon in the browser tab, as the site's own pages do: the
 * live site's copy, or, for an icon the live site doesn't have yet, the
 * repository's. Returns a function that stops waiting for it.
 */
export function showSiteIcon(doc: Document, favicon: string, previews: MediaPreviews): () => void {
  let stopped = false;
  const set = (href: string) => {
    if (stopped) return;
    let link = doc.head.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = doc.createElement("link");
      link.rel = "icon";
      doc.head.append(link);
    }
    link.href = href;
  };
  const live = previews.resolve(favicon);
  // A tab doesn't say when its icon fails, so try the address first.
  const probe = new Image();
  probe.onload = () => set(live);
  probe.onerror = () => void previews.load(favicon).then((loaded) => loaded && set(loaded));
  probe.src = live;
  return () => {
    stopped = true;
    probe.onload = probe.onerror = null;
  };
}
