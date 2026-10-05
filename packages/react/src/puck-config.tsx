import type { GoodfellowConfig } from "@goodfellow/core";
import type { ComponentConfig, Config, Fields, TextField } from "@puckeditor/core";
import type { ReactNode } from "react";

/** The field every block gets for adding CSS classes, such as Tailwind utilities. */
export const classNameField: TextField = {
  type: "text",
  label: "CSS classes",
};

/** Settings on the page itself (the root of the page's Puck data). */
const pageRootFields: Fields = {
  title: { type: "text", label: "Page title" },
  description: { type: "textarea", label: "Description for search engines" },
  image: { type: "text", label: "Image when shared (URL)" },
  className: classNameField,
};

// biome-ignore lint/suspicious/noExplicitAny: blocks have arbitrary props
type AnyComponentConfig = ComponentConfig<any>;

/**
 * Gives a block a "CSS classes" field. Blocks that declare their own
 * `className` field apply it themselves; any other block is wrapped in a
 * `<div>` carrying the classes, but only when some are set.
 */
export function withClassName(component: AnyComponentConfig): AnyComponentConfig {
  if (component.fields && "className" in component.fields) return component;

  const Inner = component.render;
  const { resolveFields } = component;

  return {
    ...component,
    fields: { ...component.fields, className: classNameField },
    ...(resolveFields && {
      resolveFields: async (data, params) => ({ ...(await resolveFields(data, params)), className: classNameField }),
    }),
    render: (props) => {
      const className = typeof props.className === "string" ? props.className.trim() : "";
      return className ? (
        <div className={className}>
          <Inner {...props} />
        </div>
      ) : (
        <Inner {...props} />
      );
    },
  };
}

const TEMPLATE_ONLY = Symbol.for("goodfellow.templateOnly");

/**
 * Marks a block as only for collection templates, such as one that shows a
 * field of the entry being displayed. It's left out of the editor for pages,
 * the header and the footer.
 */
export function templateOnly<T extends AnyComponentConfig>(component: T): T {
  return Object.assign(component, { [TEMPLATE_ONLY]: true });
}

export function isTemplateOnly(component: AnyComponentConfig): boolean {
  return TEMPLATE_ONLY in component;
}

/** Pages; the header and footer; or a collection's template, which is a page that can also show the entry's fields. */
export type PuckConfigKind = "page" | "layout" | "template";

/**
 * Turns a site's Goodfellow config into the Puck config for pages, for the
 * header and footer, or for collection templates. They share the site's
 * blocks; pages and templates also have page settings.
 */
export function createPuckConfig(config: GoodfellowConfig, kind: PuckConfigKind): Config {
  const included = Object.entries(config.blocks).filter(
    ([, component]) => kind === "template" || !isTemplateOnly(component),
  );
  const names = new Set(included.map(([name]) => name));
  const components = Object.fromEntries(included.map(([name, component]) => [name, withClassName(component)]));
  const categories =
    config.categories &&
    Object.fromEntries(
      Object.entries(config.categories).map(([key, category]) => [
        key,
        { ...category, components: category.components?.filter((name) => names.has(String(name))) },
      ]),
    );

  return {
    components,
    ...(categories && { categories }),
    root: {
      fields: kind === "layout" ? {} : pageRootFields,
      render: ({ children }: { children?: ReactNode }) => <>{children}</>,
    },
  } as Config;
}
