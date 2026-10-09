import { classNameField, cx } from "@goodfellow-cms/react";
import type { ComponentConfig } from "@puckeditor/core";

export interface ScriptureProps {
  text: string;
  reference: string;
  align: "left" | "center";
  className: string;
}

const alignClasses: Record<ScriptureProps["align"], string> = { left: "text-left", center: "text-center mx-auto" };

/** A short passage of scripture, or any quotation, with where it's from. */
export const Scripture: ComponentConfig<ScriptureProps> = {
  label: "Scripture quote",
  fields: {
    text: { type: "textarea", label: "Quotation" },
    reference: { type: "text", label: "Where it's from", placeholder: "Matthew 11:28" },
    align: {
      type: "radio",
      label: "Alignment",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
      ],
    },
    className: classNameField,
  },
  defaultProps: { text: "Write the quotation here.", reference: "", align: "center", className: "" },
  render: ({ text, reference, align, className }) => (
    <figure className={cx("max-w-3xl", alignClasses[align], className)}>
      <blockquote className="font-heading text-2xl leading-snug text-balance italic md:text-3xl">{text}</blockquote>
      {reference && (
        <figcaption className="mt-4 text-sm font-semibold tracking-widest text-muted-foreground uppercase">
          {reference}
        </figcaption>
      )}
    </figure>
  ),
};
