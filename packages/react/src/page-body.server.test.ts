import { describe, expect, it } from "vitest";
import { hiddenFromSlots } from "./page-body.server.js";

describe("hiddenFromSlots", () => {
  it("keeps metadata readable but hides its objects from Puck's search for slots", () => {
    const entry = { content: { version: 1, fields: {} } };
    const metadata = hiddenFromSlots({ path: "/news/a", entry, collection: undefined });
    expect(metadata.entry).toBe(entry);
    expect(metadata.path).toBe("/news/a");
    expect(Object.keys(metadata)).toEqual(["path", "collection"]);
  });
});
