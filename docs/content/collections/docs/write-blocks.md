---
version: 1
title: Write blocks
description: Turn React components into blocks for the editor, following the rules that keep them working everywhere.
section: developers
order: 2
---

A block is a [Puck component](https://puckeditor.com/docs/integrating-puck/component-configuration): a React component plus the fields the editor shows for it. Add it to `blocks` in `goodfellow.config.tsx`.

```tsx
// blocks/mass-times.tsx
import { classNameField, cx } from "@goodfellow/react";
import type { ComponentConfig } from "@puckeditor/core";

export interface MassTimesProps {
  times: Array<{ day: string; time: string }>;
  className: string;
}

export const MassTimes: ComponentConfig<MassTimesProps> = {
  label: "Mass times",
  fields: {
    times: {
      type: "array",
      label: "Times",
      arrayFields: { day: { type: "text", label: "Day" }, time: { type: "text", label: "Time" } },
    },
    className: classNameField,
  },
  defaultProps: { times: [{ day: "Sunday", time: "10:00 am" }], className: "" },
  render: ({ times, className }) => (
    <dl className={cx("grid grid-cols-2 gap-2", className)}>
      {times.map((item) => (
        <div key={item.day} className="contents">
          <dt className="font-semibold">{item.day}</dt>
          <dd>{item.time}</dd>
        </div>
      ))}
    </dl>
  ),
};
```

## Rules

- **Never rename** a block's key in `blocks`, or any of its props. Content files refer to blocks and props by name.
- **CSS classes:** give every block `className: classNameField` and apply it to the outermost element. Combine classes with `cx()`, with `className` last, so an editor's classes override the block's own.
- **Complete class names:** write Tailwind classes as whole strings, using lookup tables for options (`{ sm: "gap-3", md: "gap-6" }`), or Tailwind won't find them.
- **Theme classes:** style with the theme's classes, such as `bg-primary`, `text-muted-foreground`, `font-heading` and `rounded-lg`, rather than fixed colors, so blocks follow the site's settings.
- **Site data:** read menus, settings and collections with `useSite()`, never by copying them into props.
- **Links and images:** render them with `SiteLink` and `SiteImage` from `@goodfellow/react`, not `<a>` and `<img>`, so they follow the site's base path and use `next/link` and `next/image` in Next.js. Other root-relative addresses, such as a CSS background, go through `withBase(url, useSite().base)`.
- **Media fields:** a prop holding an uploaded file's address uses `mediaField()`, which adds the media library's chooser.
- **No hooks in `render`**, other than `useSite()`: in Next.js, blocks render as Server Components. Interactive parts go in [Client Components](/docs/interactive-blocks).
- **Labels for everyone:** fields' labels and options are for people who aren't developers: "Space above and below", not "padding-y".

## Blocks for collections

In a collection's page design, Puck's `metadata` holds the item being shown (`metadata.entry`) and its collection (`metadata.collection`), for `resolveFields` and `resolveData`; `useSite().entry` has the item while rendering. Wrap blocks that only make sense there in `templateOnly()`, which leaves them out of the other editors.

Custom fields don't say what they hold, so give them `metadata: { ai: … }` (an `AiFieldHint` from `@goodfellow/ai`) for the AI assistant to fill them in.
