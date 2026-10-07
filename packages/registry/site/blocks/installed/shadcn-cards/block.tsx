import { classNameField, cx, mediaField, SiteImage, SiteLink } from "@goodfellow/react";
import type { ComponentConfig } from "@puckeditor/core";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type Columns = "2" | "3" | "4";

interface CardItem {
  title: string;
  text: string;
  image: string;
  imageAlt: string;
  linkLabel: string;
  link: string;
}

export interface CardsProps {
  title: string;
  intro: string;
  columns: Columns;
  cards: CardItem[];
  className: string;
}

const columnClasses: Record<Columns, string> = {
  "2": "sm:grid-cols-2",
  "3": "sm:grid-cols-2 lg:grid-cols-3",
  "4": "sm:grid-cols-2 lg:grid-cols-4",
};

/** A grid of cards, each with a picture, a heading, text and a link. */
const Cards: ComponentConfig<CardsProps> = {
  label: "Cards",
  fields: {
    title: { type: "text", label: "Heading" },
    intro: { type: "textarea", label: "Introduction" },
    columns: {
      type: "radio",
      label: "Cards in a row",
      options: [
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
      ],
    },
    cards: {
      type: "array",
      label: "Cards",
      arrayFields: {
        title: { type: "text", label: "Heading" },
        text: { type: "textarea", label: "Text" },
        image: mediaField("Picture"),
        imageAlt: { type: "text", label: "Description of the picture for screen readers" },
        linkLabel: { type: "text", label: "Link text" },
        link: { type: "text", label: "Links to" },
      },
      defaultItemProps: {
        title: "A card",
        text: "Say something about it.",
        image: "",
        imageAlt: "",
        linkLabel: "",
        link: "",
      },
      getItemSummary: (card) => card.title || "Card",
    },
    className: classNameField,
  },
  defaultProps: {
    title: "",
    intro: "",
    columns: "3",
    cards: [
      { title: "First", text: "Say something about it.", image: "", imageAlt: "", linkLabel: "", link: "" },
      { title: "Second", text: "Say something about it.", image: "", imageAlt: "", linkLabel: "", link: "" },
      { title: "Third", text: "Say something about it.", image: "", imageAlt: "", linkLabel: "", link: "" },
    ],
    className: "",
  },
  render: ({ title, intro, columns, cards, className }) => (
    <section className={cx("mx-auto w-full max-w-6xl px-4 py-12", className)}>
      {(title || intro) && (
        <div className="mb-8 flex max-w-3xl flex-col gap-3">
          {title && <h2 className="text-3xl font-bold tracking-tight">{title}</h2>}
          {intro && <p className="text-lg text-muted-foreground">{intro}</p>}
        </div>
      )}
      <div className={cx("grid gap-6", columnClasses[columns])}>
        {cards.map((card, index) => (
          // Cards have no ids of their own, and their order is all that tells them apart.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <Card key={index} className="overflow-hidden pt-0">
            {card.image ? (
              <SiteImage src={card.image} alt={card.imageAlt} className="aspect-video w-full object-cover" />
            ) : (
              <div className="h-0" />
            )}
            <CardHeader>
              <CardTitle className="text-xl">{card.title}</CardTitle>
              {card.text && <CardDescription className="text-base">{card.text}</CardDescription>}
            </CardHeader>
            <CardContent className="flex-1" />
            {card.linkLabel && (
              <CardFooter>
                <SiteLink href={card.link || "/"} className={buttonVariants({ variant: "outline" })}>
                  {card.linkLabel}
                </SiteLink>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </section>
  ),
};

export default Cards;
