import { classNameField, cx } from "@goodfellow/react";
import type { ComponentConfig, Slot } from "@puckeditor/core";
import { type Gap, gapClasses, gapLabels, options, yesNo } from "./options.js";

type Width = "narrow" | "normal" | "wide" | "full";
type Padding = "none" | "sm" | "md" | "lg";
type Background = "none" | "muted" | "primary" | "secondary";

export interface SectionProps {
  content: Slot;
  width: Width;
  padding: Padding;
  background: Background;
  backgroundImage: string;
  className: string;
}

const widthClasses: Record<Width, string> = {
  narrow: "max-w-2xl",
  normal: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

// "none" adds no class, so padding can come from the block's CSS classes instead.
const paddingClasses: Record<Padding, string> = { none: "", sm: "py-6", md: "py-12", lg: "py-20" };

const backgroundClasses: Record<Background, string> = {
  none: "",
  muted: "bg-muted",
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
};

/** A full-width band of the page that centers its content. */
export const Section: ComponentConfig<SectionProps> = {
  label: "Section",
  fields: {
    content: { type: "slot" },
    width: {
      type: "select",
      label: "Content width",
      options: options({ narrow: "Narrow", normal: "Normal", wide: "Wide", full: "Full width" }),
    },
    padding: {
      type: "select",
      label: "Space above and below",
      options: options({ none: "None", sm: "Small", md: "Medium", lg: "Large" }),
    },
    background: {
      type: "select",
      label: "Background color",
      options: options({ none: "None", muted: "Subtle", primary: "Primary", secondary: "Secondary" }),
    },
    backgroundImage: { type: "text", label: "Background image (URL)" },
    className: classNameField,
  },
  defaultProps: {
    content: [],
    width: "normal",
    padding: "md",
    background: "none",
    backgroundImage: "",
    className: "",
  },
  render: ({ content: Content, width, padding, background, backgroundImage, className }) => (
    <section
      className={cx(
        paddingClasses[padding],
        backgroundClasses[background],
        backgroundImage && "bg-cover bg-center",
        className,
      )}
      style={backgroundImage ? { backgroundImage: `url(${JSON.stringify(backgroundImage)})` } : undefined}
    >
      <Content className={cx("mx-auto px-4", widthClasses[width])} />
    </section>
  ),
};

type Columns = "1" | "2" | "3" | "4";

export interface GridProps {
  items: Slot;
  columns: Columns;
  gap: Gap;
  className: string;
}

const columnClasses: Record<Columns, string> = {
  "1": "grid-cols-1",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-3",
  "4": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

/** Columns of equal width. On phones, they stack. */
export const Grid: ComponentConfig<GridProps> = {
  label: "Columns",
  fields: {
    items: { type: "slot" },
    columns: { type: "select", label: "Columns", options: options({ "1": "1", "2": "2", "3": "3", "4": "4" }) },
    gap: { type: "select", label: "Space between", options: options(gapLabels) },
    className: classNameField,
  },
  defaultProps: { items: [], columns: "2", gap: "md", className: "" },
  render: ({ items: Items, columns, gap, className }) => (
    <Items className={cx("grid", columnClasses[columns], gapClasses[gap], className)} />
  ),
};

type Direction = "row" | "column";
type Justify = "start" | "center" | "end" | "between";
type Align = "start" | "center" | "end" | "stretch";

export interface FlexProps {
  items: Slot;
  direction: Direction;
  justify: Justify;
  align: Align;
  gap: Gap;
  wrap: boolean;
  className: string;
}

const justifyClasses: Record<Justify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
};

const alignClasses: Record<Align, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

/** A row or column of blocks, such as a group of buttons. */
export const Flex: ComponentConfig<FlexProps> = {
  label: "Row",
  fields: {
    items: { type: "slot" },
    direction: { type: "radio", label: "Direction", options: options({ row: "Across", column: "Down" }) },
    justify: {
      type: "select",
      label: "Arrange",
      options: options({ start: "Start", center: "Center", end: "End", between: "Spread out" }),
    },
    align: {
      type: "select",
      label: "Align",
      options: options({ start: "Start", center: "Center", end: "End", stretch: "Stretch" }),
    },
    gap: { type: "select", label: "Space between", options: options(gapLabels) },
    wrap: { type: "radio", label: "Wrap onto new lines", options: yesNo },
    className: classNameField,
  },
  defaultProps: {
    items: [],
    direction: "row",
    justify: "start",
    align: "center",
    gap: "md",
    wrap: true,
    className: "",
  },
  render: ({ items: Items, direction, justify, align, gap, wrap, className }) => (
    <Items
      className={cx(
        "flex",
        direction === "column" ? "flex-col" : "flex-row",
        wrap && "flex-wrap",
        justifyClasses[justify],
        alignClasses[align],
        gapClasses[gap],
        className,
      )}
    />
  ),
};

type SpaceSize = "sm" | "md" | "lg" | "xl";

export interface SpaceProps {
  size: SpaceSize;
  className: string;
}

const spaceClasses: Record<SpaceSize, string> = { sm: "h-4", md: "h-8", lg: "h-16", xl: "h-24" };

/** Empty vertical space. */
export const Space: ComponentConfig<SpaceProps> = {
  label: "Space",
  fields: {
    size: {
      type: "select",
      label: "Size",
      options: options({ sm: "Small", md: "Medium", lg: "Large", xl: "Extra large" }),
    },
    className: classNameField,
  },
  defaultProps: { size: "md", className: "" },
  render: ({ size, className }) => <div aria-hidden="true" className={cx(spaceClasses[size], className)} />,
};
