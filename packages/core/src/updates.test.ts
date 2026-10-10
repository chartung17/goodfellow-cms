import { describe, expect, it } from "vitest";
import {
  availableUpdates,
  chooseUpdate,
  findUpdateResult,
  formatUpdateResult,
  releaseVersions,
  siteVersion,
} from "./updates.js";

const versions = ["0.3.0", "0.4.0", "0.4.1", "0.4.2-beta.1", "0.4.3", "0.5.0", "0.5.1", "1.0.0-rc.1"];

describe("choosing an update", () => {
  it("finds the newest fixes for the site's release, and the newest release", () => {
    expect(availableUpdates("0.4.1", versions)).toEqual({ fixes: "0.4.3", newer: "0.5.1" });
    expect(availableUpdates("0.5.1", versions)).toEqual({});
    expect(availableUpdates("^0.4.3", versions)).toEqual({ newer: "0.5.1" });
  });

  it("chooses fixes, the newest, or a release itself, never an older one or a pre-release", () => {
    expect(chooseUpdate("0.4.1", versions, "fixes")).toBe("0.4.3");
    expect(chooseUpdate("0.4.3", versions, "fixes")).toBeUndefined();
    expect(chooseUpdate("0.4.1", versions, "latest")).toBe("0.5.1");
    expect(chooseUpdate("0.4.1", versions, "0.5.0")).toBe("0.5.0");
    expect(chooseUpdate("0.4.1", versions, "0.3.0")).toBeUndefined();
    expect(chooseUpdate("0.4.1", versions, "1.0.0-rc.1")).toBeUndefined();
    expect(chooseUpdate("0.4.1", versions, "9.9.9")).toBeUndefined();
  });

  it("reads releases from npm's metadata, oldest first", () => {
    expect(releaseVersions({ versions: { "0.10.0": {}, "0.9.1": {}, "0.9.0-rc.1": {} } })).toEqual(["0.9.1", "0.10.0"]);
    expect(releaseVersions(null)).toEqual([]);
  });

  it("reads the site's version from its package.json", () => {
    expect(siteVersion(JSON.stringify({ dependencies: { "@goodfellow-cms/react": "0.4.1" } }))).toBe("0.4.1");
    expect(siteVersion(JSON.stringify({ dependencies: { "@goodfellow-cms/react": "workspace:*" } }))).toBeUndefined();
    expect(siteVersion("not json")).toBeUndefined();
  });
});

describe("update results", () => {
  it("are found in a log", () => {
    const result = { state: "updated" as const, from: "0.4.1", to: "0.4.3", kept: [] };
    expect(findUpdateResult(`Installing…\n${formatUpdateResult(result)}\nDone`)).toEqual(result);
    expect(findUpdateResult("goodfellow-update {}")).toBeUndefined();
  });
});
