"use client";

import { SiteLink, useSite } from "@goodfellow-cms/react";
import { useState } from "react";

export function CounterButton({ label, className }: { label: string; className: string }) {
  const { settings, path } = useSite();
  const [count, setCount] = useState(0);
  return (
    <div className={className}>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        {label} {count} times
      </button>
      <p>
        {settings.title} at {path}
      </p>
      <SiteLink href="/about">About this site</SiteLink>
    </div>
  );
}
