import type { ComponentConfig } from "@puckeditor/core";
import { describe, expect, it } from "vitest";
import { classNameField, createPuckConfig, templateOnly, withClassName } from "./puck-config.js";

const plain: ComponentConfig<{ text: string }> = {
  fields: { text: { type: "text" } },
  render: ({ text }) => <p>{text}</p>,
};

describe("withClassName", () => {
  it("adds a CSS classes field", () => {
    expect(withClassName(plain).fields?.className).toBe(classNameField);
  });

  it("leaves blocks that handle className themselves alone", () => {
    const own: ComponentConfig<{ className: string }> = {
      fields: { className: classNameField },
      render: ({ className }) => <p className={className} />,
    };
    expect(withClassName(own)).toBe(own);
  });

  it("keeps the field when the block resolves its own fields", async () => {
    const dynamic = withClassName({ ...plain, resolveFields: async () => ({ text: { type: "textarea" } }) });
    // biome-ignore lint/suspicious/noExplicitAny: params aren't used by this resolver
    const fields = await dynamic.resolveFields?.({ props: { id: "x" } } as any, {} as any);
    expect(Object.keys(fields ?? {})).toEqual(["text", "className"]);
  });
});

describe("createPuckConfig", () => {
  it("gives pages their settings and the layout none", () => {
    const config = { blocks: { Plain: plain } };
    expect(Object.keys(createPuckConfig(config, "page").root?.fields ?? {})).toEqual([
      "title",
      "description",
      "image",
      "className",
    ]);
    expect(createPuckConfig(config, "layout").root?.fields).toEqual({});
  });

  it("offers template-only blocks in templates alone", () => {
    const config = {
      blocks: { Plain: plain, Field: templateOnly({ ...plain }) },
      categories: { all: { title: "All", components: ["Plain", "Field"] } },
    };
    const page = createPuckConfig(config, "page");
    const template = createPuckConfig(config, "template");
    expect(Object.keys(page.components)).toEqual(["Plain"]);
    expect(page.categories?.all?.components).toEqual(["Plain"]);
    expect(Object.keys(template.components)).toEqual(["Plain", "Field"]);
    expect(Object.keys(template.root?.fields ?? {})).toContain("title");
  });
});
