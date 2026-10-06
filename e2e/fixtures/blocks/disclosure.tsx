"use client";

import { type ReactNode, useId, useState } from "react";

/** Shows its content only once opened: content from the server, which may hold Client Components of its own. */
export function Disclosure({
  title,
  open: startOpen,
  children,
}: {
  title: string;
  open: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  const id = useId();
  return (
    <section>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>
        {title}
      </button>
      {open && <div id={id}>{children}</div>}
    </section>
  );
}
