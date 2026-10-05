import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileSystemSource } from "./node-fs-source.js";

describe("fileSystemSource", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "goodfellow-source-"));
    await mkdir(join(root, "content/pages/news"), { recursive: true });
    await mkdir(join(root, "public/media"), { recursive: true });
    for (const file of ["content/pages/index.json", "content/pages/news/index.json", "content/pages/404.json"]) {
      await writeFile(join(root, file), "{}");
    }
    await writeFile(join(root, "public/media/note.txt"), "hello\n");
  });

  afterAll(() => rm(root, { recursive: true, force: true }));

  it("lists files recursively as sorted repo-relative paths", async () => {
    expect(await fileSystemSource(root).list("content/pages")).toEqual([
      "content/pages/404.json",
      "content/pages/index.json",
      "content/pages/news/index.json",
    ]);
  });

  it("returns nothing for missing files and folders", async () => {
    const source = fileSystemSource(root);
    expect(await source.read("content/menus.json")).toBeUndefined();
    expect(await source.list("content/missing")).toEqual([]);
  });

  it("reads files as text", async () => {
    expect(await fileSystemSource(root).read("public/media/note.txt")).toBe("hello\n");
  });
});
