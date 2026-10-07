import { classNameField, cx, mediaField, SiteImage, SiteLink } from "@goodfellow/react";
import type { ComponentConfig } from "@puckeditor/core";
import { buttonVariants } from "@/components/ui/button";

type Layout = "centered" | "beside";

export interface HeroProps {
  title: string;
  text: string;
  image: string;
  imageAlt: string;
  layout: Layout;
  primaryLabel: string;
  primaryLink: string;
  secondaryLabel: string;
  secondaryLink: string;
  className: string;
}

/** A large heading at the top of a page, with text, up to two buttons and a picture. */
const Hero: ComponentConfig<HeroProps> = {
  label: "Hero",
  fields: {
    title: { type: "text", label: "Heading", contentEditable: true },
    text: { type: "textarea", label: "Text", contentEditable: true },
    image: mediaField("Picture"),
    imageAlt: { type: "text", label: "Description of the picture for screen readers" },
    layout: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "Centered, picture below", value: "centered" },
        { label: "Picture beside the text", value: "beside" },
      ],
    },
    primaryLabel: { type: "text", label: "Main button" },
    primaryLink: { type: "text", label: "Main button links to" },
    secondaryLabel: { type: "text", label: "Second button (optional)" },
    secondaryLink: { type: "text", label: "Second button links to" },
    className: classNameField,
  },
  defaultProps: {
    title: "Welcome",
    text: "Say in a sentence or two what this site is about.",
    image: "",
    imageAlt: "",
    layout: "centered",
    primaryLabel: "Find out more",
    primaryLink: "/about",
    secondaryLabel: "",
    secondaryLink: "",
    className: "",
  },
  render: ({
    title,
    text,
    image,
    imageAlt,
    layout,
    primaryLabel,
    primaryLink,
    secondaryLabel,
    secondaryLink,
    className,
  }) => {
    const beside = layout === "beside";
    return (
      <section className={cx("mx-auto w-full max-w-6xl px-4 py-16 md:py-24", className)}>
        <div
          className={cx("flex flex-col gap-10", beside ? "md:flex-row md:items-center" : "items-center text-center")}
        >
          <div className={cx("flex flex-col gap-6", beside ? "md:flex-1" : "max-w-3xl items-center")}>
            <h1 className="text-4xl font-bold tracking-tight text-balance md:text-6xl">{title}</h1>
            {text && <p className="text-lg text-muted-foreground md:text-xl">{text}</p>}
            {(primaryLabel || secondaryLabel) && (
              <div className="flex flex-wrap gap-3">
                {primaryLabel && (
                  <SiteLink href={primaryLink || "/"} className={buttonVariants({ size: "lg" })}>
                    {primaryLabel}
                  </SiteLink>
                )}
                {secondaryLabel && (
                  <SiteLink href={secondaryLink || "/"} className={buttonVariants({ size: "lg", variant: "outline" })}>
                    {secondaryLabel}
                  </SiteLink>
                )}
              </div>
            )}
          </div>
          {image && (
            <SiteImage
              src={image}
              alt={imageAlt}
              className={cx("w-full rounded-xl object-cover", beside ? "md:w-1/2" : "max-w-4xl")}
            />
          )}
        </div>
      </section>
    );
  },
};

export default Hero;
