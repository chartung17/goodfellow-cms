import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readMediaSizes } from "./node-media.js";

describe("readMediaSizes", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "goodfellow-media-"));
    await mkdir(join(root, "public/media/logos"), { recursive: true });
    await writeFile(
      join(root, "public/media/logos/mark.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32"/>',
    );
    await writeFile(join(root, "public/media/bulletin.pdf"), "%PDF-1.4");
    await writeFile(join(root, "public/media/broken.png"), "not a png");
  });

  afterAll(() => rm(root, { recursive: true, force: true }));

  it("lists the images it can read, by address", async () => {
    expect(await readMediaSizes(root)).toEqual({ "/media/logos/mark.svg": { width: 64, height: 32 } });
  });

  it("returns nothing for a site without media", async () => {
    expect(await readMediaSizes(join(root, "missing"))).toEqual({});
  });
});
