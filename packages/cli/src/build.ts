import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { absoluteUrl, loadSiteContent, pageOutputFile } from "@goodfellow/core";
import { createServer, build as viteBuild } from "vite";
import { applyBasePath, normalizeBase } from "./base-path.js";
import { fileSystemSource } from "./fs-source.js";
import { baseViteConfig, findConfigFile, loadServerEntry, writeStylesEntries } from "./site.js";

export interface BuildOptions {
  /** The site's folder. Defaults to the current directory. */
  root?: string;
  /** Where to write the built site, relative to the root. Defaults to `dist`. */
  outDir?: string;
  /** Overrides the config's `base`. */
  base?: string;
}

export interface BuildResult {
  outDir: string;
  /** Repo-relative paths of the HTML files written. */
  pages: string[];
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Builds a static site: one HTML file per page, the site's CSS, the public folder, and a sitemap if the site's address is set. */
export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  const root = resolve(options.root ?? ".");
  const outDir = resolve(root, options.outDir ?? "dist");
  const configFile = findConfigFile(root);

  // Pages are rendered by modules loaded through Vite, so the site's config can use TSX and shares one copy of React.
  const server = await createServer({
    ...baseViteConfig(root, configFile),
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });

  try {
    const { config, renderPage } = await loadServerEntry(server);
    const base = normalizeBase(options.base ?? config.base);
    const content = await loadSiteContent(fileSystemSource(root));
    const stylesEntry = (await writeStylesEntries(root, config)).site;

    // Build the CSS (Tailwind scans content/ for class names) and copy public/ into the output.
    await viteBuild({
      ...baseViteConfig(root, configFile),
      base,
      build: {
        outDir,
        emptyOutDir: true,
        manifest: "manifest.json",
        rolldownOptions: { input: { styles: stylesEntry } },
      },
    });

    const manifestPath = join(outDir, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<
      string,
      { file: string; css?: string[] }
    >;
    await rm(manifestPath);
    const entry = Object.values(manifest).find((chunk) => chunk.file.endsWith(".css") || chunk.css?.length);
    const stylesheets = entry
      ? (entry.file.endsWith(".css") ? [entry.file] : (entry.css ?? [])).map((file) => `/${file}`)
      : [];

    const written: string[] = [];
    for (const page of content.pages) {
      const html = applyBasePath(await renderPage(content, page, { stylesheets }), base);
      const file = join(outDir, pageOutputFile(page.path));
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, html);
      written.push(relative(root, file).split("\\").join("/"));
    }

    const { url } = content.settings;
    if (url) {
      const urls = content.pages
        .filter((page) => page.path !== "/404")
        .map((page) => `  <url><loc>${escapeXml(absoluteUrl(url, page.path))}</loc></url>`);
      await writeFile(
        join(outDir, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
      );
      await writeFile(
        join(outDir, "robots.txt"),
        `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl(url, "/sitemap.xml")}\n`,
      );
    }

    return { outDir, pages: written };
  } finally {
    await server.close();
  }
}
