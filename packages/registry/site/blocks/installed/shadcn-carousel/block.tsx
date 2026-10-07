import { classNameField, cx, mediaField } from "@goodfellow/react";
import type { ComponentConfig } from "@puckeditor/core";
import { ImageCarousel } from "./image-carousel";

interface Slide {
  image: string;
  alt: string;
  caption: string;
}

export interface CarouselProps {
  slides: Slide[];
  loop: boolean;
  className: string;
}

/** Pictures shown one at a time, with buttons to move between them. */
const Carousel: ComponentConfig<CarouselProps> = {
  label: "Image carousel",
  fields: {
    slides: {
      type: "array",
      label: "Pictures",
      arrayFields: {
        image: mediaField("Picture"),
        alt: { type: "text", label: "Description for screen readers" },
        caption: { type: "text", label: "Caption" },
      },
      defaultItemProps: { image: "", alt: "", caption: "" },
      getItemSummary: (slide, index) => slide.caption || slide.alt || `Picture ${(index ?? 0) + 1}`,
    },
    loop: {
      type: "radio",
      label: "Start again after the last picture",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    className: classNameField,
  },
  defaultProps: { slides: [], loop: true, className: "" },
  render: ({ slides, loop, className }) => (
    <section className={cx("mx-auto w-full max-w-4xl px-14 py-8", className)}>
      {slides.length > 0 ? (
        <ImageCarousel slides={slides.filter((slide) => slide.image)} loop={loop} />
      ) : (
        <div className="aspect-video w-full rounded-xl bg-muted" />
      )}
    </section>
  ),
};

export default Carousel;
