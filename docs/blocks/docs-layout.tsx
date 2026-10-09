import { classNameField, cx } from "@goodfellow-cms/react";
import type { ComponentConfig, Slot } from "@puckeditor/core";

export interface DocsLayoutProps {
  sidebar: Slot;
  content: Slot;
  aside: Slot;
  className: string;
}

/**
 * A documentation page's columns: navigation on the left, the page in the
 * middle and "On this page" on the right, which leave room for the page on
 * smaller screens (the navigation moves below it, and "On this page" is hidden).
 */
export const DocsLayout: ComponentConfig<DocsLayoutProps> = {
  label: "Documentation layout",
  fields: {
    sidebar: { type: "slot" },
    content: { type: "slot" },
    aside: { type: "slot" },
    className: classNameField,
  },
  defaultProps: { sidebar: [], content: [], aside: [], className: "" },
  render: ({ sidebar: Sidebar, content: Content, aside: Aside, className }) => (
    <div
      className={cx(
        "mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_12rem]",
        className,
      )}
    >
      <Sidebar className="order-last lg:sticky lg:top-6 lg:order-first lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto" />
      <Content className="min-w-0" />
      <Aside className="hidden xl:sticky xl:top-6 xl:block xl:self-start" />
    </div>
  ),
};
