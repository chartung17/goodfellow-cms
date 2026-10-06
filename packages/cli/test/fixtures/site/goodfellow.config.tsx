import { blocks } from "@goodfellow/blocks";
import { defineConfig } from "@goodfellow/core";
import { Counter } from "./blocks/counter";

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
    Counter: {
      fields: { label: { type: "text" } },
      render: ({ label }) => (
        <Counter label={label}>
          <p>From the server</p>
        </Counter>
      ),
    },
  },
  base: "/from-config/",
});
