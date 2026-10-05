import { describe, expect, it } from "vitest";
import * as browser from "./index.js";
import * as server from "./index.server.js";

describe("the Server Components entry", () => {
  it("exports everything the main entry does, so blocks work in both", () => {
    expect(Object.keys(server).sort()).toEqual(Object.keys(browser).sort());
  });
});
