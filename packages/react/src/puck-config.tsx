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

export type PuckConfigKind = "page" | "layout";

/**
 * Turns a site's Goodfellow config into the Puck config for pages or for the
 * header and footer. Both share the site's blocks; only pages have page settings.
 */
export function createPuckConfig(config: GoodfellowConfig, kind: PuckConfigKind): Config {
  const components = Object.fromEntries(
    Object.entries(config.blocks).map(([name, component]) => [name, withClassName(component)]),
  );

  return {
    components,
    ...(config.categories && { categories: config.categories }),
    root: {
      fields: kind === "page" ? pageRootFields : {},
      render: ({ children }: { children?: ReactNode }) => <>{children}</>,
    },
  } as Config;
}
