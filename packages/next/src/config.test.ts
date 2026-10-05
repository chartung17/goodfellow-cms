import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withGoodfellow } from "./config.js";

describe("withGoodfellow", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "goodfellow-next-"));
    await mkdir(join(root, "content"), { recursive: true });
    await writeFile(join(root, "content/site.json"), '{"version":1}\n');
  });

  afterAll(() => rm(root, { recursive: true, force: true }));

  it("builds static files, keeping the site's own settings", async () => {
    const config = await withGoodfellow({ reactStrictMode: true }, { root })("phase-production-build");
    expect(config).toEqual({
      output: "export",
      trailingSlash: true,
      reactStrictMode: true,
      images: { unoptimized: true },
      env: { GOODFELLOW_BASE_PATH: "" },
    });
    expect(await withGoodfellow({ trailingSlash: false }, { root })("phase-production-build")).toMatchObject({
      trailingSlash: false,
    });
  });

  it("runs the local backend in development, behind the site's address", async () => {
    const config = await withGoodfellow(
      { rewrites: async () => [{ source: "/old", destination: "/new" }] },
      { root },
    )("phase-development-server");
    expect(config.output).toBeUndefined();

    const rewrites = await config.rewrites?.();
    if (!Array.isArray(rewrites)) throw new Error("Expected a list of rewrites.");
    expect(rewrites).toHaveLength(2);
    const [api, own] = rewrites;
    expect(own).toEqual({ source: "/old", destination: "/new" });
    expect(api?.source).toBe("/__goodfellow/api/:path*");

    const url = api?.destination.replace(":path*", "revision") ?? "";
    const headers = { "x-goodfellow-request": "1" };
    const response = await fetch(url, { headers: { ...headers, origin: "http://localhost:3000" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("revision");
    expect((await fetch(url, { headers: { ...headers, origin: "https://evil.example" } })).status).toBe(403);
  });

  it("adds its rewrite ahead of the site's when they're grouped", async () => {
    const config = await withGoodfellow(
      { rewrites: async () => ({ beforeFiles: [], afterFiles: [{ source: "/a", destination: "/b" }], fallback: [] }) },
      { root },
    )("phase-development-server");
    const rewrites = await config.rewrites?.();
    if (Array.isArray(rewrites) || !rewrites) throw new Error("Expected grouped rewrites.");
    expect(rewrites.beforeFiles?.[0]?.source).toBe("/__goodfellow/api/:path*");
    expect(rewrites.afterFiles).toEqual([{ source: "/a", destination: "/b" }]);
  });

  it("serves the site from its base path, from the config or GOODFELLOW_BASE", async () => {
    const config = await withGoodfellow({ basePath: "/site/" }, { root })("phase-production-build");
    expect(config).toMatchObject({ basePath: "/site", env: { GOODFELLOW_BASE_PATH: "/site" } });

    process.env.GOODFELLOW_BASE = "/from-env/";
    try {
      expect(await withGoodfellow({}, { root })("phase-production-build")).toMatchObject({ basePath: "/from-env" });
    } finally {
      delete process.env.GOODFELLOW_BASE;
    }
  });

  it("keeps the site's image loader, which can optimize images", async () => {
    const images = { loader: "custom" as const, loaderFile: "./loader.ts" };
    const config = await withGoodfellow({ images }, { root })("phase-production-build");
    expect(config.images).toEqual(images);
  });
});
