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
    const config = await withGoodfellow({ images: { unoptimized: true } }, { root })("phase-production-build");
    expect(config).toEqual({ output: "export", trailingSlash: true, images: { unoptimized: true } });
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

  it("refuses a base path, which links in the site's content wouldn't follow", () => {
    expect(() => withGoodfellow({ basePath: "/site" }, { root })).toThrow("basePath isn't supported");
  });
});
