import { classNameField } from "@goodfellow/react";
import type { ComponentConfig } from "@puckeditor/core";
import { CounterButton } from "./counter-button";

/** A block whose component runs in the browser, to test Client Components in blocks. */
export const Counter: ComponentConfig<{ label: string; className: string }> = {
  label: "Counter",
  fields: { label: { type: "text", label: "Label" }, className: classNameField },
  defaultProps: { label: "Clicked", className: "" },
  render: ({ label, className }) => <CounterButton label={label} className={className} />,
};
