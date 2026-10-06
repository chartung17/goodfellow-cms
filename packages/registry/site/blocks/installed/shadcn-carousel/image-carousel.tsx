"use client";

import { SiteImage } from "@goodfellow/react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

/** The pictures, one at a time, with previous and next buttons. */
export function ImageCarousel({
  slides,
  loop,
}: {
  slides: Array<{ image: string; alt: string; caption: string }>;
  loop: boolean;
}) {
  return (
    <Carousel opts={{ loop }}>
      <CarouselContent>
        {slides.map((slide, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: pictures have no ids of their own
          <CarouselItem key={index}>
            <figure>
              <SiteImage src={slide.image} alt={slide.alt} className="aspect-video w-full rounded-xl object-cover" />
              {slide.caption && (
                <figcaption className="mt-2 text-center text-sm text-muted-foreground">{slide.caption}</figcaption>
              )}
            </figure>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
