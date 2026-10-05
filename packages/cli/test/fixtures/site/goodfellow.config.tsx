import { blocks } from "@goodfellow/blocks";
import { defineConfig } from "@goodfellow/core";

function Greeting({ name }: { name: string }) {
  return <p className="greeting text-teal-600">Hello, {name}!</p>;
}

export default defineConfig({
  blocks: {
    ...blocks,
    Greeting: {
      fields: { name: { type: "text" } },
      render: ({ name }) => <Greeting name={name} />,
    },
  },
  base: "/from-config/",
});
