import { describe, expect, it } from "vitest";
import { cx } from "./cx.js";

describe("cx", () => {
  it("joins classes and skips empty values", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("lets later Tailwind classes override earlier ones", () => {
    expect(cx("py-20 bg-primary text-primary-foreground", "py-4")).toBe("bg-primary text-primary-foreground py-4");
    expect(cx("grid grid-cols-1 md:grid-cols-3 gap-6", "gap-2 md:grid-cols-2")).toBe(
      "grid grid-cols-1 gap-2 md:grid-cols-2",
    );
  });

  it("understands the theme's classes", () => {
    expect(cx("bg-muted", "bg-primary")).toBe("bg-primary");
    expect(cx("text-muted-foreground", "text-red-500")).toBe("text-red-500");
    expect(cx("font-heading font-bold", "font-sans")).toBe("font-bold font-sans");
    expect(cx("rounded-lg", "rounded-none")).toBe("rounded-none");
  });

  it("keeps classes that refine rather than conflict, and non-Tailwind classes", () => {
    expect(cx("p-6", "py-0")).toBe("p-6 py-0");
    expect(cx("gf-prose text-left", "text-center")).toBe("gf-prose text-center");
  });
});
