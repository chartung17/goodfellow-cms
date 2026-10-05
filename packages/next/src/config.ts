import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { DEV_API_PREFIX, handleDevApi, isLocalOrigin, localFileStore } from "@goodfellow/core/node";
import type { NextConfig } from "next";

export interface GoodfellowNextOptions {
  /** The site's folder, holding `content/` and `public/media/`. Defaults to the folder Next.js runs in. */
  root?: string;
}

type Rewrites = Awaited<ReturnType<NonNullable<NextConfig["rewrites"]>>>;
type Rewrite = Extract<Rewrites, unknown[]>[number];

/** `PHASE_DEVELOPMENT_SERVER` from `next/constants`, which Node can't import by that name. */
const PHASE_DEVELOPMENT_SERVER = "phase-development-server";

const SERVER_KEY = Symbol.for("goodfellow.next.devApi");

/**
 * The admin panel's local backend, which reads and writes the site's files on
 * disk. It runs beside `next dev`, on this computer only, and Next.js passes
 * the admin panel's requests to it. Started once however often Next.js loads its config.
 */
function startDevApi(root: string): Promise<number> {
  const globals = globalThis as { [SERVER_KEY]?: Promise<number> };
  globals[SERVER_KEY] ??= new Promise((resolvePort, reject) => {
    const store = localFileStore(root);
    const server = createServer(async (req, res) => {
      // Requests come through Next.js's development server, so they're from its address rather than this one's.
      if (!(await handleDevApi(store, req, res, { trustOrigin: isLocalOrigin }))) res.writeHead(404).end();
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolvePort((server.address() as AddressInfo).port));
    // Never keeps Next.js running on its own.
    server.unref();
  });
  return globals[SERVER_KEY];
}

/** Adds a rewrite ahead of the site's own, whichever form the site's rewrites take. */
function withRewrite(rewrites: Rewrites | undefined, rewrite: Rewrite): Rewrites {
  if (!rewrites) return [rewrite];
  if (Array.isArray(rewrites)) return [rewrite, ...rewrites];
  return { ...rewrites, beforeFiles: [rewrite, ...(rewrites.beforeFiles ?? [])] };
}

/**
 * Sets up Next.js for a Goodfellow site, in `next.config.ts`:
 * `export default withGoodfellow({ ... })`.
 *
 * - Builds the site as static files (`output: "export"`), so any static host can serve it,
 *   with each page in its own folder (`trailingSlash: true`), as `goodfellow build` does.
 *   `next dev` serves pages as usual, so an unknown address shows the "not found" page.
 * - In `next dev`, runs the admin panel's local backend, so publishing saves to
 *   the files on disk. It's never part of a build.
 */
export function withGoodfellow(nextConfig: NextConfig = {}, options: GoodfellowNextOptions = {}) {
  const root = resolve(options.root ?? process.cwd());
  if (nextConfig.basePath) {
    // Links in the site's content start at the root of the address, and nothing adds the base path to them yet.
    throw new Error(
      "Goodfellow sites built with Next.js must be served from the root of their address, so basePath isn't supported yet.",
    );
  }
  return async (phase: string): Promise<NextConfig> => {
    // Pages are folders (about/index.html), as `goodfellow build` writes them, so /admin/ works for GitLab sign-in.
    const config: NextConfig = { trailingSlash: true, ...nextConfig };
    // In development, Next.js treats an unknown address in an exported site as an error rather than "not found".
    if (phase !== PHASE_DEVELOPMENT_SERVER) return { output: "export", ...config };

    const port = await startDevApi(root);
    const rewrite = {
      source: `${DEV_API_PREFIX}/:path*`,
      destination: `http://127.0.0.1:${port}${DEV_API_PREFIX}/:path*`,
    };
    return {
      ...config,
      rewrites: async () => withRewrite(await nextConfig.rewrites?.(), rewrite),
    };
  };
}
