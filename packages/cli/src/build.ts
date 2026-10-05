import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { absoluteUrl, allPages, applyBasePath, loadSiteContent, normalizeBase, pageOutputFile } from "@goodfellow/core";
import { fileSystemSource } from "@goodfellow/core/node";
import { createServer, build as viteBuild } from "vite";
import { ADMIN_ENTRY, adminEntryPlugin, adminHtml } from "./admin-entry.js";
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

interface ManifestChunk {
  file: string;
  name?: string;
  src?: string;
  isEntry?: boolean;
  css?: string[];
}

type Manifest = Record<string, ManifestChunk>;

/** Finds a build input in Vite's manifest by the name it was given in `input`. */
function findEntry(manifest: Manifest, name: string): ManifestChunk | undefined {
  return Object.values(manifest).find((chunk) => chunk.isEntry && chunk.name === name);
}

/** The CSS files a build input produced: the file itself for CSS inputs, or the CSS its JavaScript imports. */
function cssFiles(manifest: Manifest, name: string): string[] {
  const entry = findEntry(manifest, name);
  if (!entry) return [];
  return entry.file.endsWith(".css") ? [entry.file] : (entry.css ?? []);
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
    const styles = await writeStylesEntries(root, config);
    const withAdmin = Boolean(config.backend);

    // Build the CSS (Tailwind scans content/ for class names), the admin panel if the
    // site has a backend, and copy public/ into the output.
    const input: Record<string, string> = { styles: styles.site };
    if (withAdmin) Object.assign(input, { preview: styles.preview, admin: ADMIN_ENTRY });
    await viteBuild({
      ...baseViteConfig(root, configFile),
      plugins: [...(baseViteConfig(root, configFile).plugins ?? []), adminEntryPlugin(configFile, { mode: "build" })],
      base,
      build: {
        outDir,
        emptyOutDir: true,
        manifest: "manifest.json",
        // The admin panel bundles Puck and its editor, which is large but only loads at /admin.
        chunkSizeWarningLimit: 4096,
        rolldownOptions: {
          input,
          onLog(level, log, handler) {
            // React libraries mark modules "use client", which only matters to server-component bundlers.
            if (log.code === "MODULE_LEVEL_DIRECTIVE") return;
            handler(level, log);
          },
        },
      },
    });

    const manifestPath = join(outDir, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
    await rm(manifestPath);
    const stylesheets = cssFiles(manifest, "styles").map((file) => `/${file}`);

    if (withAdmin) {
      const admin = findEntry(manifest, "admin");
      if (!admin) throw new Error("The admin panel's bundle is missing from the build.");
      const html = adminHtml({
        scripts: [`${base}${admin.file}`],
        stylesheets: cssFiles(manifest, "admin").map((file) => `${base}${file}`),
        settings: { previewStylesheets: cssFiles(manifest, "preview").map((file) => `${base}${file}`), siteUrl: base },
      });
      await mkdir(join(outDir, "admin"), { recursive: true });
      await writeFile(join(outDir, "admin/index.html"), html);
    }

    const pages = allPages(content);
    const written: string[] = [];
    for (const page of pages) {
      const html = applyBasePath(await renderPage(content, page, { stylesheets }), base);
      const file = join(outDir, pageOutputFile(page.path));
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, html);
      written.push(relative(root, file).split("\\").join("/"));
    }

    const { url } = content.settings;
    if (url) {
      const urls = pages
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
