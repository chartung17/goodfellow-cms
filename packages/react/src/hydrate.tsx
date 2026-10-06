import { type ComponentType, createElement, type ReactNode, useEffect, useRef } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { ISLAND_TAG, identifierPrefix, SITE_DATA_ID, SLOT_MARKER, SLOT_TAG } from "./island-shared.js";
import { SiteProvider } from "./site-context.js";
import type { SiteContextValue } from "./site-types.js";

/** Loads a module with Client Components, by the name islands give it. */
export type IslandModules = Record<string, () => Promise<Record<string, unknown>>>;

let modules: IslandModules = {};
let site: SiteContextValue | undefined;
/** Islands already being brought to life, so none is started twice. */
const started = new WeakSet<Element>();
const roots = new WeakMap<Element, Root>();

/** Content passed to an island, which stays the HTML the server rendered. Islands inside it run on their own. */
function Slot({ id, html }: { id: string; html: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Shown again after being hidden, the content is new HTML whose islands haven't started.
    hydrateWithin(element);
    return () => {
      const inside = Array.from(element.querySelectorAll(ISLAND_TAG));
      // React can't unmount a root while it's rendering this one.
      setTimeout(() => {
        for (const island of inside) {
          roots.get(island)?.unmount();
          roots.delete(island);
        }
      });
    };
  }, []);
  return createElement(SLOT_TAG, {
    ref,
    "data-gf-slot": id,
    style: { display: "contents" },
    // The server's rendering of the content, read from the page itself.
    dangerouslySetInnerHTML: { __html: html },
    suppressHydrationWarning: true,
  });
}

/** The HTML of an island's slots: those its component rendered, and those it kept for later in templates. */
function slotHtml(island: Element, id: string): Map<string, string> {
  const html = new Map<string, string>();
  const prefix = `${id}.`;
  for (const slot of island.querySelectorAll(SLOT_TAG)) {
    const slotId = slot.getAttribute("data-gf-slot");
    if (slotId?.startsWith(prefix) && !html.has(slotId)) html.set(slotId, slot.innerHTML);
  }
  for (let next = island.nextElementSibling; next instanceof HTMLTemplateElement; next = next.nextElementSibling) {
    const slotId = next.getAttribute("data-gf-slot");
    if (slotId?.startsWith(prefix) && !html.has(slotId)) html.set(slotId, next.innerHTML);
  }
  return html;
}

function decode(value: unknown, slots: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => decode(item, slots));
  if (value && typeof value === "object") {
    const marker = (value as Record<string, unknown>)[SLOT_MARKER];
    if (typeof marker === "string") return createElement(Slot, { id: marker, html: slots.get(marker) ?? "" });
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item, slots)]));
  }
  return value;
}

/** Starts every island in `scope` that hasn't started yet. */
function hydrateWithin(scope: ParentNode): void {
  // Read everything first: once an island runs, its component may change the HTML of islands inside it.
  const pending: Array<{ island: Element; id: string; module: string; name: string; props: unknown }> = [];
  for (const island of scope.querySelectorAll(ISLAND_TAG)) {
    if (started.has(island)) continue;
    started.add(island);
    const module = island.getAttribute("data-gf-island") ?? "";
    const name = island.getAttribute("data-gf-export") ?? "";
    const id = island.getAttribute("data-gf-id") ?? "";
    if (!modules[module]) {
      console.error(`Goodfellow: no Client Component module named ${module}. Rebuild the site.`);
      continue;
    }
    let props: unknown;
    try {
      props = decode(JSON.parse(island.getAttribute("data-gf-props") ?? "{}"), slotHtml(island, id));
    } catch (error) {
      console.error(`Goodfellow: the props of ${name} in ${module} couldn't be read.`, error);
      continue;
    }
    pending.push({ island, id, module, name, props });
  }

  for (const { island, id, module, name, props } of pending) {
    modules[module]?.().then(
      (loaded) => {
        const Component = loaded[name] as ComponentType<Record<string, unknown>> | undefined;
        if (!Component) {
          console.error(`Goodfellow: ${module} has no export named ${name}. Rebuild the site.`);
          return;
        }
        // Removed while its module loaded, such as when the content around it was hidden.
        if (!island.isConnected) return;
        let element: ReactNode = createElement(Component, props as Record<string, unknown>);
        if (site) element = <SiteProvider value={site}>{element}</SiteProvider>;
        roots.set(island, hydrateRoot(island, element, { identifierPrefix: identifierPrefix(id) }));
      },
      (error: unknown) => console.error(`Goodfellow: ${name} couldn't be loaded.`, error),
    );
  }
}

/**
 * Brings a page's islands to life: each Client Component a block used is
 * loaded and takes over the HTML the server rendered for it. `goodfellow`
 * adds a script that calls this to pages with islands.
 */
export function hydrateIslands(loaders: IslandModules): void {
  modules = loaders;
  const data = document.getElementById(SITE_DATA_ID)?.textContent;
  site = data ? (JSON.parse(data) as SiteContextValue) : undefined;
  hydrateWithin(document);
}
