import { afterEach, describe, expect, it, vi } from "vitest";
import { localStore } from "./dev.js";

describe("localStore", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** A server that answers every request with 404, like one that isn't `goodfellow dev`. */
  function answerNotFound() {
    vi.stubGlobal("location", { href: "http://localhost:4321/admin" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "not-found" }), { status: 404 })),
    );
  }

  it("says where it looked when the development server's API isn't there", async () => {
    answerNotFound();
    const store = localStore();
    await expect(store.revision()).rejects.toThrow(
      "The development server's API isn't at http://localhost:4321/__goodfellow/api (it answered 404).",
    );
    await expect(store.list("content/pages")).rejects.toThrow("answered 404");
  });

  it("calls the API with a trailing slash, which Next.js doesn't redirect", async () => {
    vi.stubGlobal("location", { href: "http://localhost:4321/admin" });
    const fetch = vi.fn(
      async (url: string) =>
        new Response(JSON.stringify(url.includes("revision") ? { revision: "r1" } : { files: [] })),
    );
    vi.stubGlobal("fetch", fetch);
    const store = localStore();
    expect(await store.revision()).toBe("r1");
    expect(await store.list("content/pages")).toEqual([]);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "/__goodfellow/api/revision/",
      "/__goodfellow/api/files/?dir=content%2Fpages",
    ]);
  });

  it("reads a file that isn't there as missing", async () => {
    answerNotFound();
    expect(await localStore().read("content/code/head.html")).toBeUndefined();
  });
});
