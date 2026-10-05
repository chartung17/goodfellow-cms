import { type FSWatcher, watch } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import {
  allPages,
  CONTENT_DIR,
  ContentError,
  loadSiteContent,
  normalizePagePath,
  type Page,
  type SiteContent,
} from "@goodfellow/core";
import react from "@vitejs/plugin-react";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { ADMIN_ENTRY, adminEntryPlugin, adminHtml } from "./admin-entry.js";
import { handleDevApi } from "./dev-api.js";
import { fileSystemSource } from "./fs-source.js";
import { localFileStore } from "./local-files.js";
import {
  baseViteConfig,
  devUrl,
  findConfigFile,
  loadServerEntry,
  type StylesEntries,
  writeStylesEntries,
} from "./site.js";

export interface DevOptions {
  root?: string;
  port?: number;
}

const CONTENT_CHANGED = "goodfellow:content-changed";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function errorPage(title: string, lines: string[]): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:48rem;margin:3rem auto;padding:0 1rem;line-height:1.5">
<h1 style="color:#b91c1c">${escapeHtml(title)}</h1><ul>${lines.map((line) => `<li><code>${escapeHtml(line)}</code></li>`).join("")}</ul>
</body></html>`;
}

function findPage(content: SiteContent, pathname: string): { page: Page; status: number } | undefined {
  let path: string;
  try {
    path = normalizePagePath(decodeURIComponent(pathname));
  } catch {
    path = "";
  }
  const pages = allPages(content);
  const page = pages.find((candidate) => candidate.path === path);
  if (page) return { page, status: 200 };
  const notFound = pages.find((candidate) => candidate.path === "/404");
  return notFound && { page: notFound, status: 404 };
}

/** Reloads site pages when content changes on disk. The admin panel doesn't listen, so saving never reloads the editor. */
const RELOAD_ON_CONTENT_CHANGE = `<script type="module">
import { createHotContext } from "/@vite/client";
createHotContext("/__goodfellow/reload").on("${CONTENT_CHANGED}", () => location.reload());
</script>`;

/**
 * Tells site pages to reload when content changes, after making Vite recompile
 * the site's CSS (Tailwind scans content/ for class names).
 *
 * content/ is hidden from Vite's own watcher on purpose: Tailwind's Vite plugin
 * reloads every open page when a file it scans changes, which would reload the
 * admin panel (and lose the editor's state) each time it publishes.
 */
function watchContent(server: ViteDevServer, root: string, styles: () => StylesEntries): void {
  const dir = join(root, CONTENT_DIR);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watcher: FSWatcher | undefined;
  let closed = false;

  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { moduleGraph } = server.environments.client;
      for (const entry of [styles().site, styles().preview]) {
        for (const module of moduleGraph.getModulesByFile(entry) ?? []) moduleGraph.invalidateModule(module);
      }
      server.environments.client.hot.send({ type: "custom", event: CONTENT_CHANGED });
    }, 50);
  };

  // Watching breaks if folders are deleted while it scans them (for example when
  // content/ is replaced wholesale), so start again whenever it fails.
  const start = () => {
    if (closed) return;
    try {
      watcher = watch(dir, { recursive: true }, changed);
      watcher.on("error", () => {
        watcher?.close();
        changed();
        setTimeout(start, 250);
      });
    } catch {
      setTimeout(start, 250);
    }
  };
  start();

  server.httpServer?.once("close", () => {
    closed = true;
    clearTimeout(timer);
    watcher?.close();
  });
}

/** Serves the local backend's API, the admin panel at /admin, and pages rendered on request from the files on disk. */
function devPlugin(root: string, styles: () => StylesEntries): Plugin {
  const store = localFileStore(root);
  return {
    name: "goodfellow:dev",
    configureServer(server: ViteDevServer) {
      watchContent(server, root, styles);

      // Runs after Vite's own middleware, so modules, assets and public/ files are served first.
      return () => {
        server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (await handleDevApi(store, req, res)) return;
          if (req.method !== "GET" && req.method !== "HEAD") return next();
          const url = new URL(req.url ?? "/", "http://localhost");

          res.setHeader("Content-Type", "text/html; charset=utf-8");
          if (url.pathname === "/admin" || url.pathname === "/admin/") {
            const html = adminHtml({ scripts: [`/@id/__x00__${ADMIN_ENTRY}`] });
            res.end(await server.transformIndexHtml("/admin", html));
            return;
          }
          if (/\.[a-z0-9]+$/i.test(url.pathname)) return next();

          try {
            const content = await loadSiteContent(fileSystemSource(root));
            const match = findPage(content, url.pathname);
            if (!match) {
              res.statusCode = 404;
              res.end(errorPage("Page not found", [`No page is stored for ${url.pathname}.`]));
              return;
            }
            const { renderPage } = await loadServerEntry(server);
            const html = await renderPage(content, match.page, {
              stylesheets: [`${devUrl(root, styles().site)}?direct`],
            });
            res.statusCode = match.status;
            const transformed = await server.transformIndexHtml(url.pathname, html);
            res.end(transformed.replace("</body>", `${RELOAD_ON_CONTENT_CHANGE}</body>`));
          } catch (error) {
            res.statusCode = 500;
            if (error instanceof ContentError) {
              res.end(
                errorPage(
                  "Some content files have problems",
                  error.problems.map((p) => `${p.file}: ${p.message}`),
                ),
              );
            } else {
              const err = error as Error;
              server.ssrFixStacktrace(err);
              res.end(errorPage("The page couldn't be rendered", [err.stack ?? err.message]));
            }
          }
        });
      };
    },
  };
}

/** Starts the development server, with the admin panel at /admin. Resolves once it's listening. */
export async function dev(options: DevOptions = {}): Promise<ViteDevServer> {
  const root = resolve(options.root ?? ".");
  const configFile = findConfigFile(root);
  let styles: StylesEntries | undefined;
  const getStyles = () => {
    if (!styles) throw new Error("The development server isn't ready yet.");
    return styles;
  };

  const base = baseViteConfig(root, configFile);
  const server = await createServer({
    ...base,
    appType: "custom",
    logLevel: "info",
    server: {
      port: options.port ?? 4321,
      strictPort: options.port !== undefined,
      // Watched separately by watchContent().
      watch: { ignored: [`${join(root, CONTENT_DIR)}/**`] },
    },
    plugins: [
      react(),
      ...(base.plugins ?? []),
      adminEntryPlugin(configFile, {
        mode: "dev",
        get previewStylesheet() {
          return `${devUrl(root, getStyles().preview)}?direct`;
        },
      }),
      devPlugin(root, getStyles),
    ],
  });

  const { config } = await loadServerEntry(server);
  styles = await writeStylesEntries(root, config);
  await server.listen();
  server.printUrls();
  server.config.logger.info(`  ➜  Admin:   ${server.resolvedUrls?.local[0] ?? "/"}admin`);
  return server;
}
