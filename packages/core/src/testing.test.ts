import { describe, expect, it } from "vitest";
import { FakeConflictError, FakeRepo } from "./testing.js";

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
