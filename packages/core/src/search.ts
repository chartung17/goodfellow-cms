/**
 * Site search with Pagefind (https://pagefind.app). Builds index a site's pages
 * only when one of them has a search block, which says so with this attribute.
 * Third-party blocks that search with Pagefind add it too.
 */
export const SEARCH_ATTRIBUTE = "data-goodfellow-search";

/** Where builds write the search index, relative to the site's address. Search blocks load Pagefind from here. */
export const SEARCH_INDEX_DIR = "pagefind";
