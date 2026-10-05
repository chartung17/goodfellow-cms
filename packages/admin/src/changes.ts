import {
  CURRENT_VERSION,
  CUSTOM_CSS_FILE,
  type FileChange,
  isReservedPagePath,
  MENUS_FILE,
  type Menus,
  normalizePagePath,
  type Page,
  pagePathToFile,
  SITE_FILE,
  type SiteSettings,
  serializeContent,
} from "@goodfellow/core";
import type { Data } from "@puckeditor/core";

/** `"Mass & Confession Times"` → `"mass-confession-times"`. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The title shown for a page in lists: its own title, or its address. */
export function pageTitle(page: Page): string {
  const title = page.content.data.root.props?.title;
  return typeof title === "string" && title.trim() ? title.trim() : page.path;
}

export type AddressProblem = "invalid" | "reserved" | "taken";

/**
 * Checks an address typed for a page. Returns the normalized path, or why it
 * can't be used. `current` is the page's existing address, if it has one.
 */
export function checkPageAddress(
  input: string,
  pages: Page[],
  current?: string,
): { ok: true; path: string } | { ok: false; problem: AddressProblem } {
  let path: string;
  try {
    path = normalizePagePath(input.trim().startsWith("/") ? input.trim() : `/${input.trim()}`);
  } catch {
    return { ok: false, problem: "invalid" };
  }
  if (isReservedPagePath(path)) return { ok: false, problem: "reserved" };
  if (path !== current && pages.some((page) => page.path === path)) return { ok: false, problem: "taken" };
  return { ok: true, path };
}

/** Puck data as stored: Puck adds an empty `zones` object, which only adds noise to the file. */
export function storedData(data: Data): Data {
  if (!data.zones || Object.keys(data.zones).length > 0) return data;
  const { zones: _empty, ...rest } = data;
  return rest;
}

export function pageFileChange(path: string, data: Data): FileChange {
  return {
    path: pagePathToFile(path),
    content: serializeContent({ version: CURRENT_VERSION.page, data: storedData(data) }),
  };
}

export function layoutFileChange(file: string, data: Data): FileChange {
  return { path: file, content: serializeContent({ version: CURRENT_VERSION.layout, data: storedData(data) }) };
}

/** A new, empty page with just a title. */
export function newPageData(title: string): Data {
  return { root: { props: { title } }, content: [] };
}

/** Points every menu link at `from` (or inside it) to `to` instead. Returns `undefined` if no link changed. */
export function updateMenuLinks(menus: Menus, from: string, to: string): Menus | undefined {
  let changed = false;
  const move = (href: string) => {
    if (href === from || href.startsWith(`${from}/`)) {
      changed = true;
      return `${to}${href.slice(from.length)}` || "/";
    }
    return href;
  };
  const updated = Object.fromEntries(
    Object.entries(menus).map(([name, items]) => [
      name,
      items.map((item) => ({
        ...item,
        href: move(item.href),
        ...(item.children && { children: item.children.map((child) => ({ ...child, href: move(child.href) })) }),
      })),
    ]),
  );
  return changed ? updated : undefined;
}

export function menusFileChange(menus: Menus): FileChange {
  return { path: MENUS_FILE, content: serializeContent({ version: CURRENT_VERSION.menus, menus }) };
}

/** Moves a page to a new address in one save, optionally updating menu links to it. */
export function movePageChanges(page: Page, to: string, menus: Menus, updateLinks: boolean): FileChange[] {
  const changes: FileChange[] = [
    { path: page.file, delete: true },
    { path: pagePathToFile(to), content: serializeContent({ ...page.content, version: CURRENT_VERSION.page }) },
  ];
  const updatedMenus = updateLinks ? updateMenuLinks(menus, page.path, to) : undefined;
  if (updatedMenus) changes.push(menusFileChange(updatedMenus));
  return changes;
}

export function siteSettingsFileChange(settings: SiteSettings): FileChange {
  return { path: SITE_FILE, content: serializeContent({ ...settings, version: CURRENT_VERSION.site }) };
}

/** Custom CSS as stored: ending in one newline, or empty. */
export function storedCss(css: string): string {
  return css.trim() ? `${css.trimEnd()}\n` : "";
}

export function customCssFileChange(css: string): FileChange {
  const stored = storedCss(css);
  return stored ? { path: CUSTOM_CSS_FILE, content: stored } : { path: CUSTOM_CSS_FILE, delete: true };
}
