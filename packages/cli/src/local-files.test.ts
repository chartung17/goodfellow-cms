import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConflictError, type ContentStore } from "@goodfellow/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvalidPathError, localFileStore } from "./local-files.js";

describe("localFileStore", () => {
  let root: string;
  let store: ContentStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "goodfellow-store-"));
    store = localFileStore(root);
  });

  afterEach(() => rm(root, { recursive: true, force: true }));

  it("writes and deletes files together, and returns the new revision", async () => {
    const start = await store.revision();
    const { revision } = await store.write(
      [
        { path: "content/pages/index.json", content: "{}" },
        { path: "content/pages/news/index.json", content: "[]" },
      ],
      { message: "Add pages", expectedRevision: start },
    );
    expect(revision).not.toBe(start);
    expect(revision).toBe(await store.revision());
    expect(await store.list("content/pages")).toEqual(["content/pages/index.json", "content/pages/news/index.json"]);

    await store.write([{ path: "content/pages/index.json", delete: true }], {
      message: "Delete",
      expectedRevision: revision,
    });
    expect(await store.read("content/pages/index.json")).toBeUndefined();
  });

  it("refuses to write over changes made since the editor loaded", async () => {
    const start = await store.revision();
    await writeFile(join(root, "content-outside.txt"), "ignored: not an editable file");
    expect(await store.revision()).toBe(start);

    await store.write([{ path: "content/site.json", content: "{}" }], { message: "Mine", expectedRevision: start });
    await expect(
      store.write([{ path: "content/site.json", content: '{"stale":true}' }], {
        message: "Stale",
        expectedRevision: start,
      }),
    ).rejects.toThrow(ConflictError);
    expect(await readFile(join(root, "content/site.json"), "utf8")).toBe("{}");
  });

  it("applies saves one at a time, so two saves from the same revision can't both succeed", async () => {
    const start = await store.revision();
    const results = await Promise.allSettled([
      store.write([{ path: "content/a.json", content: "1" }], { message: "A", expectedRevision: start }),
      store.write([{ path: "content/b.json", content: "2" }], { message: "B", expectedRevision: start }),
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
  });

  it("only touches files under content/ and public/media/", async () => {
    const start = await store.revision();
    await expect(
      store.write([{ path: "goodfellow.config.tsx", content: "x" }], { message: "Bad", expectedRevision: start }),
    ).rejects.toThrow(InvalidPathError);
    await expect(store.read("package.json")).rejects.toThrow(InvalidPathError);
    await expect(store.list("src")).rejects.toThrow(InvalidPathError);
    await expect(store.read("content/../package.json")).rejects.toThrow(InvalidPathError);
  });
});
