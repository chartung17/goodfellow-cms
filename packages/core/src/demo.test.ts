import { describe, expect, it } from "vitest";
import type { ContentSource } from "./content/load.js";
import { ConflictError } from "./content/store.js";
import {
  DEMO_CONTENT_PATH,
  demoContent,
  demoContentStore,
  demoStore,
  isDemoStore,
  memoryDemoStorage,
  parseDemoContent,
} from "./demo.js";

const files: Record<string, string> = {
  "content/site.json": '{"version":1}\n',
  "content/pages/index.json": '{"version":1,"data":{}}\n',
  "blocks/installed/installed.json": '{"version":1,"blocks":{}}\n',
  "public/media/logo.svg": "<svg></svg>",
  "src/styles.css": "@import 'tailwindcss';\n",
};

const source: ContentSource = {
  read: async (path) => files[path],
  list: async (dir) => Object.keys(files).filter((path) => path.startsWith(`${dir}/`)),
};

const logo = new TextEncoder().encode("<svg>from the site</svg>");

async function base() {
  const content = parseDemoContent(await demoContent(source));
  return demoContentStore(
    async () => content,
    async (path) => (path === "public/media/logo.svg" ? logo : undefined),
  );
}

describe("demoContent", () => {
  it("copies content and the installed blocks' record, and lists media without copying it", async () => {
    const content = parseDemoContent(await demoContent(source));
    expect(Object.keys(content.files).sort()).toEqual([
      "blocks/installed/installed.json",
      "content/pages/index.json",
      "content/site.json",
    ]);
    expect(content.media).toEqual(["public/media/logo.svg"]);
    expect(DEMO_CONTENT_PATH).toBe("admin/demo-content.json");
  });

  it("changes its revision when the files do", async () => {
    const before = parseDemoContent(await demoContent(source)).revision;
    files["content/site.json"] = '{"version":1,"title":"New"}\n';
    expect(parseDemoContent(await demoContent(source)).revision).not.toBe(before);
  });

  it("refuses anything else", () => {
    expect(() => parseDemoContent('{"version":2}')).toThrow();
  });
});

describe("demoContentStore", () => {
  it("reads the copied files, and media from the site", async () => {
    const store = await base();
    expect(await store.read("content/pages/index.json")).toBe('{"version":1,"data":{}}\n');
    expect(await store.read("src/styles.css")).toBeUndefined();
    expect(await store.list("public/media")).toEqual(["public/media/logo.svg"]);
    expect(await store.readBytes("public/media/logo.svg")).toEqual(logo);
    expect(await store.readBytes("public/media/other.svg")).toBeUndefined();
  });
});

describe("demoStore", () => {
  it("keeps saves in its storage, over the site's content", async () => {
    const storage = memoryDemoStorage();
    const store = demoStore(await base(), storage);
    expect(isDemoStore(store)).toBe(true);
    const revision = await store.revision();
    const photo = new Uint8Array([1, 2, 3]);
    const next = await store.write(
      [
        { path: "content/pages/about.json", content: "about\n" },
        { path: "content/pages/index.json", delete: true },
        { path: "public/media/photo.jpg", bytes: photo },
      ],
      { message: "Change things", expectedRevision: revision },
    );
    expect(next.revision).not.toBe(revision);
    expect(await store.read("content/pages/about.json")).toBe("about\n");
    expect(await store.read("content/pages/index.json")).toBeUndefined();
    expect(await store.list("content/pages")).toEqual(["content/pages/about.json"]);
    expect(await store.list("public/media")).toEqual(["public/media/logo.svg", "public/media/photo.jpg"]);
    expect(await store.readBytes("public/media/photo.jpg")).toEqual(photo);

    // Another visit, in the same browser, picks up where this one left off.
    const later = demoStore(await base(), storage);
    expect(await later.revision()).toBe(next.revision);
    expect(await later.read("content/pages/about.json")).toBe("about\n");
    expect((await later.changes()).map((change) => change.path).sort()).toEqual([
      "content/pages/about.json",
      "content/pages/index.json",
      "public/media/photo.jpg",
    ]);
  });

  it("refuses a save from a tab that loaded an older version", async () => {
    const storage = memoryDemoStorage();
    const first = demoStore(await base(), storage);
    const second = demoStore(await base(), storage);
    const revision = await first.revision();
    expect(await second.revision()).toBe(revision);
    await first.write([{ path: "content/site.json", content: "first\n" }], { message: "", expectedRevision: revision });
    await expect(
      second.write([{ path: "content/site.json", content: "second\n" }], { message: "", expectedRevision: revision }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("starts over", async () => {
    const storage = memoryDemoStorage();
    const store = demoStore(await base(), storage);
    await store.write([{ path: "content/site.json", content: "changed\n" }], {
      message: "",
      expectedRevision: await store.revision(),
    });
    await store.reset();
    await store.revision();
    expect(await store.read("content/site.json")).toBe(files["content/site.json"]);
    expect(await store.changes()).toEqual([]);
    expect(await storage.load()).toBeUndefined();
  });
});
