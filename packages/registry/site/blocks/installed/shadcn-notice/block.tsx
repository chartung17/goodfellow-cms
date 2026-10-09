import { classNameField, cx } from "@goodfellow-cms/react";
import type { ComponentConfig, RichText } from "@puckeditor/core";
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Kind = "info" | "warning" | "success" | "urgent";

export interface NoticeProps {
  kind: Kind;
  title: string;
  text: RichText;
  className: string;
}

const icons = { info: InfoIcon, warning: TriangleAlertIcon, success: CircleCheckIcon, urgent: TriangleAlertIcon };

/** A short message that stands out, such as a closure or a change of times. */
const Notice: ComponentConfig<NoticeProps> = {
  label: "Notice",
  fields: {
    kind: {
      type: "select",
      label: "Kind",
      options: [
        { label: "Information", value: "info" },
        { label: "Warning", value: "warning" },
        { label: "Good news", value: "success" },
        { label: "Urgent", value: "urgent" },
      ],
    },
    title: { type: "text", label: "Heading", contentEditable: true },
    text: { type: "richtext", label: "Text", contentEditable: true },
    className: classNameField,
  },
  defaultProps: { kind: "info", title: "Please note", text: "<p>Say what's changed.</p>", className: "" },
  render: ({ kind, title, text, className }) => {
    const Icon = icons[kind];
    return (
      <div className={cx("mx-auto w-full max-w-3xl px-4 py-4", className)}>
        <Alert variant={kind === "urgent" ? "destructive" : "default"}>
          <Icon aria-hidden="true" />
          {title && <AlertTitle>{title}</AlertTitle>}
          <AlertDescription>
            <div className="gf-prose">{text}</div>
          </AlertDescription>
        </Alert>
      </div>
    );
  },
};

export default Notice;
