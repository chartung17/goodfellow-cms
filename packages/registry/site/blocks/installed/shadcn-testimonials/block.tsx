import { classNameField, cx, mediaField, SiteImage } from "@goodfellow/react";
import type { ComponentConfig } from "@puckeditor/core";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  photo: string;
}

export interface TestimonialsProps {
  title: string;
  testimonials: Testimonial[];
  className: string;
}

/** Quotes from people, with their names and photos. */
const Testimonials: ComponentConfig<TestimonialsProps> = {
  label: "Testimonials",
  fields: {
    title: { type: "text", label: "Heading" },
    testimonials: {
      type: "array",
      label: "Quotes",
      arrayFields: {
        quote: { type: "textarea", label: "What they said" },
        name: { type: "text", label: "Name" },
        role: { type: "text", label: "Who they are, such as a member since 2020" },
        photo: mediaField("Photo"),
      },
      defaultItemProps: { quote: "Something kind they said.", name: "A name", role: "", photo: "" },
      getItemSummary: (item) => item.name || "Quote",
    },
    className: classNameField,
  },
  defaultProps: {
    title: "What people say",
    testimonials: [
      { quote: "Something kind they said.", name: "A name", role: "", photo: "" },
      { quote: "Something else kind they said.", name: "Another name", role: "", photo: "" },
    ],
    className: "",
  },
  render: ({ title, testimonials, className }) => (
    <section className={cx("mx-auto w-full max-w-6xl px-4 py-12", className)}>
      {title && <h2 className="mb-8 text-3xl font-bold tracking-tight">{title}</h2>}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: quotes have no ids of their own
          <Card key={index}>
            <CardContent className="flex-1">
              <blockquote className="text-lg leading-relaxed">“{item.quote}”</blockquote>
            </CardContent>
            <CardFooter className="gap-3">
              {item.photo && (
                <SiteImage src={item.photo} alt="" className="size-10 shrink-0 rounded-full object-cover" />
              )}
              <div className="flex flex-col">
                <span className="font-semibold">{item.name}</span>
                {item.role && <span className="text-sm text-muted-foreground">{item.role}</span>}
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  ),
};

export default Testimonials;
