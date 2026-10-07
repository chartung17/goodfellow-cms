"use client";

import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/** The questions, one open at a time. Closed answers stay in the page, hidden, rather than being left out. */
export function FaqList({ questions }: { questions: Array<{ question: string; answer: ReactNode }> }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {questions.map((item, index) => (
        <AccordionItem
          // biome-ignore lint/suspicious/noArrayIndexKey: questions have no ids of their own
          key={index}
          value={`question-${index}`}
          className="[&>[data-slot=accordion-content][data-state=closed]]:hidden"
        >
          <AccordionTrigger className="text-base">{item.question}</AccordionTrigger>
          <AccordionContent forceMount>
            <div className="gf-prose">{item.answer}</div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
