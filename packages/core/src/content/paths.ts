/** Where everything lives in a site's repository. Paths are relative to the repo root. */
export const CONTENT_DIR = "content";
export const PAGES_DIR = "content/pages";
export const SITE_FILE = "content/site.json";
export const MENUS_FILE = "content/menus.json";
export const HEADER_FILE = "content/layout/header.json";
export const FOOTER_FILE = "content/layout/footer.json";
export const CUSTOM_CSS_FILE = "content/styles/custom.css";
export const MEDIA_DIR = "public/media";

/** A URL path segment: lowercase letters, digits and single hyphens. */
const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class InvalidPathError extends Error {
  override name = "InvalidPathError";
}

/** `"/about/team"` → `["about", "team"]`; `"/"` → `[]`. Throws on invalid paths. */
export function pathSegments(path: string): string[] {
  if (!path.startsWith("/")) {
    throw new InvalidPathError(`Page addresses must start with "/" (got "${path}").`);
  }
  const segments = path.split("/").filter((segment) => segment !== "");
  for (const segment of segments) {
    if (!SEGMENT.test(segment)) {
      throw new InvalidPathError(
        `"${segment}" can't be part of a page address. Use lowercase letters, numbers and hyphens only.`,
      );
    }
  }
  return segments;
}

/** Addresses used by Goodfellow itself, which pages can't use. */
export const RESERVED_PAGE_PATHS = ["/admin"];

/** Whether a page path is, or is inside, an address Goodfellow reserves. */
export function isReservedPagePath(path: string): boolean {
  return RESERVED_PAGE_PATHS.some((reserved) => path === reserved || path.startsWith(`${reserved}/`));
}

/** Normalizes a page path: `"/about/"` → `"/about"`. */
export function normalizePagePath(path: string): string {
  return `/${pathSegments(path).join("/")}`;
}

/** The content file for a page: `"/"` → `content/pages/index.json`, `"/about"` → `content/pages/about.json`. */
export function pagePathToFile(path: string): string {
  const segments = pathSegments(path);
  return segments.length === 0 ? `${PAGES_DIR}/index.json` : `${PAGES_DIR}/${segments.join("/")}.json`;
}

/**
 * The page a content file serves. `index.json` serves its folder, so
 * `content/pages/index.json` → `"/"` and `content/pages/news/index.json` → `"/news"`.
 */
export function pageFileToPath(file: string): string {
  const prefix = `${PAGES_DIR}/`;
  if (!file.startsWith(prefix) || !file.endsWith(".json")) {
    throw new InvalidPathError(`${file} is not a page file. Pages are .json files in ${PAGES_DIR}/.`);
  }
  const segments = file.slice(prefix.length, -".json".length).split("/");
  if (segments.at(-1) === "index") segments.pop();
  return normalizePagePath(`/${segments.join("/")}`);
}

/** The HTML file a page builds to: `"/"` → `index.html`, `"/about"` → `about/index.html`, `"/404"` → `404.html`. */
export function pageOutputFile(path: string): string {
  const segments = pathSegments(path);
  if (segments.length === 0) return "index.html";
  if (segments.length === 1 && segments[0] === "404") return "404.html";
  return `${segments.join("/")}/index.html`;
}
