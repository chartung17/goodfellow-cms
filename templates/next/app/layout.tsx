import { loadSite } from "@goodfellow/next";
import type { ReactNode } from "react";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { settings } = await loadSite();
  return (
    <html lang={settings.language}>
      <body>{children}</body>
    </html>
  );
}
