import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fileSystemSource } from "./fs-source.js";

const source = fileSystemSource(resolve(import.meta.dirname, "../test/fixtures/site"));

describe("fileSystemSource", () => {
  it("lists files recursively as sorted repo-relative paths", async () => {
    expect(await source.list("content/pages")).toEqual([
      "content/pages/404.json",
      "content/pages/index.json",
      "content/pages/news/index.json",
    ]);
  });

  it("returns nothing for missing files and folders", async () => {
    expect(await source.read("content/menus.json")).toBeUndefined();
    expect(await source.list("content/collections")).toEqual([]);
  });

  it("reads files as text", async () => {
    expect(await source.read("public/media/note.txt")).toBe("hello\n");
  });
});
