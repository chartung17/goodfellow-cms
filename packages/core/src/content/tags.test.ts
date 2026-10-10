import { describe, expect, it } from "vitest";
import { withoutTags } from "./tags.js";

describe("withoutTags", () => {
  it("takes tags out, or replaces them", () => {
    expect(withoutTags("<p>One <b>two</b></p>")).toBe("One two");
    expect(withoutTags("<p>One</p><p>Two</p>", (tag) => (tag === "</p>" ? " " : ""))).toBe("One Two ");
  });

  it("keeps a < that never closes as text", () => {
    expect(withoutTags("a < b")).toBe("a < b");
    expect(withoutTags("<i>a</i> <b")).toBe("a <b");
  });
});
