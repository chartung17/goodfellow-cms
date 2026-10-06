import { classNameField, cx } from "@goodfellow/react";
import type { ComponentConfig, RichText } from "@puckeditor/core";
import { FaqList } from "./faq-list";

interface Question {
  question: string;
  answer: RichText;
}

export interface FaqProps {
  title: string;
  questions: Question[];
  className: string;
}

/** Questions that open to show their answers. Every answer is in the page, so search engines see them. */
const Faq: ComponentConfig<FaqProps> = {
  label: "FAQ",
  fields: {
    title: { type: "text", label: "Heading" },
    questions: {
      type: "array",
      label: "Questions",
      arrayFields: {
        question: { type: "text", label: "Question" },
        answer: { type: "richtext", label: "Answer" },
      },
      defaultItemProps: { question: "A question", answer: "<p>Its answer.</p>" },
      getItemSummary: (item) => item.question || "Question",
    },
    className: classNameField,
  },
  defaultProps: {
    title: "Questions and answers",
    questions: [
      { question: "A question people ask", answer: "<p>Its answer.</p>" },
      { question: "Another question", answer: "<p>Its answer.</p>" },
    ],
    className: "",
  },
  render: ({ title, questions, className }) => (
    <section className={cx("mx-auto w-full max-w-3xl px-4 py-12", className)}>
      {title && <h2 className="mb-6 text-3xl font-bold tracking-tight">{title}</h2>}
      <FaqList questions={questions.map(({ question, answer }) => ({ question, answer }))} />
    </section>
  ),
};

export default Faq;
