import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { CUSTOM_CSS_FILE, type GoodfellowConfig } from "@goodfellow/core";
import type { PageRenderer } from "@goodfellow/react/server";
import tailwindcss from "@tailwindcss/vite";
import type { InlineConfig, Plugin, ViteDevServer } from "vite";

const CONFIG_FILES = ["goodfellow.config.tsx", "goodfellow.config.ts", "goodfellow.config.jsx", "goodfellow.config.js"];
const SERVER_ENTRY = "virtual:goodfellow/server";
const RESOLVED_SERVER_ENTRY = `\0${SERVER_ENTRY}`;

export class SiteSetupError extends Error {
  override name = "SiteSetupError";
}

export function findConfigFile(root: string): string {
  for (const name of CONFIG_FILES) {
    const path = join(root, name);
    if (existsSync(path)) return path;
  }
  throw new SiteSetupError(`No Goodfellow config found in ${root}. Create goodfellow.config.tsx.`);
}

/** The module loaded inside Vite to render pages: the site's config plus the renderer, sharing one copy of React. */
function serverEntryPlugin(configFile: string): Plugin {
  return {
    name: "goodfellow:server-entry",
    resolveId: (id) => (id === SERVER_ENTRY ? RESOLVED_SERVER_ENTRY : undefined),
    load: (id) =>
      id === RESOLVED_SERVER_ENTRY
        ? [
            `import config from ${JSON.stringify(configFile)};`,
            `import { createPageRenderer } from "@goodfellow/react/server";`,
            "export { config };",
            "export const renderPage = createPageRenderer(config);",
          ].join("\n")
        : undefined,
  };
}

export interface ServerEntry {
  config: GoodfellowConfig;
  renderPage: PageRenderer;
}

export function loadServerEntry(server: ViteDevServer): Promise<ServerEntry> {
  return server.ssrLoadModule(SERVER_ENTRY) as Promise<ServerEntry>;
}

/** Vite settings shared by every command. */
export function baseViteConfig(root: string, configFile: string): InlineConfig {
  return {
    root,
    configFile: false,
    envDir: false,
    logLevel: "warn",
    plugins: [tailwindcss(), serverEntryPlugin(configFile)],
  };
}

/**
 * Writes the stylesheet Vite builds: the site's stylesheet followed by the
 * admin's custom CSS (unlayered, so it overrides block styles). Lives in
 * node_modules/.goodfellow so it never shows up in the site's repository.
 */
export async function writeStylesEntry(root: string, config: GoodfellowConfig): Promise<string> {
  const styles = resolve(root, config.styles ?? "src/styles.css");
  if (!existsSync(styles)) {
    throw new SiteSetupError(
      `The site's stylesheet ${relative(root, styles)} doesn't exist. Create it, or set "styles" in the Goodfellow config.`,
    );
  }

  const entry = join(root, "node_modules/.goodfellow/styles.css");
  const importPath = (file: string) => JSON.stringify(relative(dirname(entry), file).split("\\").join("/"));
  const lines = [`@import ${importPath(styles)};`];
  const customCss = join(root, CUSTOM_CSS_FILE);
  if (existsSync(customCss)) lines.push(`@import ${importPath(customCss)};`);

  await mkdir(dirname(entry), { recursive: true });
  await writeFile(entry, `${lines.join("\n")}\n`);
  return entry;
}
