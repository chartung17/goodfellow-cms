import { classNameField } from "@goodfellow-cms/react";
import type { ComponentConfig } from "@puckeditor/core";
import { CounterButton } from "./counter-button";
import { Disclosure as DisclosureView } from "./disclosure";

/** A block whose component runs in the browser, to test Client Components in blocks. */
export const Counter: ComponentConfig<{ label: string; className: string }> = {
  label: "Counter",
  fields: { label: { type: "text", label: "Label" }, className: classNameField },
  defaultProps: { label: "Clicked", className: "" },
  render: ({ label, className }) => <CounterButton label={label} className={className} />,
};

/** A Client Component given content from the server, with another Client Component in it. */
export const Disclosure: ComponentConfig<{ title: string; open: boolean; className: string }> = {
  label: "Disclosure",
  fields: {
    title: { type: "text", label: "Title" },
    open: {
      type: "radio",
      label: "Starts open",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    className: classNameField,
  },
  defaultProps: { title: "More", open: false, className: "" },
  render: ({ title, open, className }) => (
    <div className={className}>
      <DisclosureView title={title} open={open}>
        <p>Text of {title}</p>
        <CounterButton label={`${title} inside`} className="" />
      </DisclosureView>
    </div>
  ),
};
