import type { IncomingMessage, ServerResponse } from "node:http";
import { join, relative, resolve } from "node:path";
import {
  CONTENT_DIR,
  ContentError,
  loadSiteContent,
  normalizePagePath,
  type Page,
  type SiteContent,
} from "@goodfellow/core";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { fileSystemSource } from "./fs-source.js";
import { baseViteConfig, findConfigFile, loadServerEntry, writeStylesEntry } from "./site.js";

export interface DevOptions {
  root?: string;
  port?: number;
}

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
  const page = content.pages.find((candidate) => candidate.path === path);
  if (page) return { page, status: 200 };
  const notFound = content.pages.find((candidate) => candidate.path === "/404");
  return notFound && { page: notFound, status: 404 };
}

/** Serves pages rendered on request from the files on disk, reloading the browser whenever content changes. */
function pagesPlugin(root: string, stylesEntry: () => string): Plugin {
  return {
    name: "goodfellow:dev-pages",
    configureServer(server: ViteDevServer) {
      const contentDir = join(root, CONTENT_DIR);
      server.watcher.on("all", (_event, file) => {
        if (file.startsWith(contentDir)) server.ws.send({ type: "full-reload" });
      });

      // Runs after Vite's own middleware, so assets and public/ files are served first.
      return () => {
        server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method !== "GET" && req.method !== "HEAD") return next();
          const url = new URL(req.url ?? "/", "http://localhost");
          if (/\.[a-z0-9]+$/i.test(url.pathname)) return next();

          res.setHeader("Content-Type", "text/html; charset=utf-8");
          try {
            const content = await loadSiteContent(fileSystemSource(root));
            const match = findPage(content, url.pathname);
            if (!match) {
              res.statusCode = 404;
              res.end(errorPage("Page not found", [`No page is stored for ${url.pathname}.`]));
              return;
            }
            const { renderPage } = await loadServerEntry(server);
            const stylesheet = `/${relative(root, stylesEntry()).split("\\").join("/")}?direct`;
            const html = await renderPage(content, match.page, { stylesheets: [stylesheet] });
            res.statusCode = match.status;
            res.end(await server.transformIndexHtml(url.pathname, html));
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

/** Starts the development server. Resolves once it's listening. */
export async function dev(options: DevOptions = {}): Promise<ViteDevServer> {
  const root = resolve(options.root ?? ".");
  const configFile = findConfigFile(root);
  let stylesEntry = "";

  const server = await createServer({
    ...baseViteConfig(root, configFile),
    appType: "custom",
    logLevel: "info",
    server: { port: options.port ?? 4321 },
    plugins: [...(baseViteConfig(root, configFile).plugins ?? []), pagesPlugin(root, () => stylesEntry)],
  });

  const { config } = await loadServerEntry(server);
  stylesEntry = await writeStylesEntry(root, config);
  await server.listen();
  server.printUrls();
  return server;
}
