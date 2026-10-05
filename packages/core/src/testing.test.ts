import { describe, expect, it } from "vitest";
import { FakeConflictError, FakeRepo, fakeFileBytes, fakeFileFromBytes } from "./testing.js";

describe("FakeRepo", () => {
  it("records commits, history and changed paths", () => {
    const repo = new FakeRepo({ "content/a.json": "1" });
    const first = repo.head();
    const second = repo.write("content/b.json", "2");
    const third = repo.commit([{ path: "content/a.json", delete: true }], "Delete a");

    expect(repo.files(first).get("content/a.json")).toBe("1");
    expect([...repo.files().keys()]).toEqual(["content/b.json"]);
    expect(repo.changedPaths(first, third)).toEqual(["content/a.json", "content/b.json"]);
    expect(repo.lastCommitFor("content/b.json")).toBe(second);
    expect(repo.lastCommitFor("content/a.json", second)).toBe(first);
    expect(() => repo.commit([], "stale", { expectedHead: first })).toThrow(FakeConflictError);
  });
});

describe("binary files", () => {
  it("keeps bytes that aren't text as bytes, and text as text", () => {
    const repo = new FakeRepo({ "content/site.json": "{}" });
    const image = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0x00]);
    const sha = repo.commit(
      [
        { path: "public/media/a.png", bytes: image },
        { path: "public/media/b.txt", bytes: new TextEncoder().encode("héllo") },
      ],
      "Upload",
    );
    expect(repo.files(sha).get("public/media/a.png")).toEqual(image);
    expect(repo.files(sha).get("public/media/b.txt")).toBe("héllo");
    expect(fakeFileBytes(repo.files(sha).get("public/media/b.txt") ?? "")).toEqual(new TextEncoder().encode("héllo"));
    expect(repo.changedPaths(repo.commitAt(sha)?.parent ?? "", sha)).toEqual([
      "public/media/a.png",
      "public/media/b.txt",
    ]);
    // The same bytes again aren't a change.
    const again = repo.commit([{ path: "public/media/a.png", bytes: new Uint8Array(image) }], "Same");
    expect(repo.changedPaths(sha, again)).toEqual([]);
    expect(fakeFileFromBytes(image)).toBe(image);
  });
});
