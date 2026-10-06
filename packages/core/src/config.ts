import type { ComponentConfig, Config } from "@puckeditor/core";
import type { GitHost } from "./git.js";

/**
 * A site's `goodfellow.config.tsx`. The site build and its `/admin` page both
 * import this, so the editor always offers exactly the blocks the site renders.
 */
export interface GoodfellowConfig {
  /** Blocks available in the editor, keyed by the name stored in content files. */
  // biome-ignore lint/suspicious/noExplicitAny: blocks have arbitrary props
  blocks: Record<string, ComponentConfig<any>>;
  /** Groups blocks in the editor's block list. */
  categories?: Config["categories"];
  /** The site's stylesheet, relative to the site root. Defaults to `src/styles.css`. */
  styles?: string;
  /**
   * The URL path the site is served from, for hosts that serve it from a
   * subfolder (for example `/my-repo/` on GitHub Pages). Defaults to `/`.
   */
  base?: string;
  /**
   * Where the site's repository lives, such as `github({ repo: "owner/name" })`.
   * Builds include the admin panel at `/admin` only when this is set.
   */
  backend?: GitHost;
  /**
   * The AI assistant in the editor, which drafts and rewrites content with an
   * AI service each editor chooses. On by default; `false` removes it.
   */
  ai?: false | AiConfig;
  /**
   * Block registries the admin panel's Blocks screen offers blocks from,
   * besides Goodfellow's own, by namespace:
   * `{ "@acme": "https://acme.example/r/{name}.json" }`. List only registries
   * you trust: installed blocks' code runs in the admin panel.
   */
  registries?: Record<string, string>;
}

export interface AiConfig {
  /**
   * The AI services editors can choose from, by id, such as `["anthropic", "manual"]`.
   * Defaults to all of them. See `PROVIDER_IDS` in `@goodfellow/ai`.
   */
  providers?: string[];
}

/** Declares a site config with full type checking. Returns it unchanged. */
export function defineConfig<const T extends GoodfellowConfig>(config: T): T {
  return config;
}
