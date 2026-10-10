import { describe, expect, it } from "vitest";
import { buildStepFor, findBuildCause, formatBuildCause } from "./build-problems.js";

describe("build causes", () => {
  it("finds the cause goodfellow build printed in a log", () => {
    const cause = { kind: "content" as const, file: "content/pages/about.json", message: "isn't valid JSON." };
    const log = `$ npx goodfellow build\nBuilding…\n2026-10-10T09:00:00Z ${formatBuildCause(cause)}\nERROR: Job failed`;
    expect(findBuildCause(log)).toEqual(cause);
  });

  it("ignores logs without one, and lines that only look like one", () => {
    expect(findBuildCause("npm ERR! code E404")).toBeUndefined();
    expect(findBuildCause("goodfellow-build-problem not json")).toBeUndefined();
    expect(findBuildCause('goodfellow-build-problem {"kind":"other","message":"x"}')).toBeUndefined();
  });
});

describe("buildStepFor", () => {
  it.each([
    ["Run npm ci", "install"],
    ["$ npm ci --cache .npm --prefer-offline", "install"],
    ["Run actions/configure-pages@v5", "pages"],
    ["Run npx goodfellow build --base /site/", "build"],
    ["$ npx goodfellow build", "build"],
    ["Run actions/deploy-pages@v4", "deploy"],
    ["pages:deploy", "deploy"],
    ["Set up job", undefined],
  ])("%s → %s", (name, step) => {
    expect(buildStepFor(name)).toBe(step);
  });
});
