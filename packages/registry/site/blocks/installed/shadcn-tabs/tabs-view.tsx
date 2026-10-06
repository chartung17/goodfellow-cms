"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** The tabs, with every tab's content in the page and the others hidden. */
export function TabsView({ tabs }: { tabs: Array<{ label: string; content: ReactNode }> }) {
  if (tabs.length === 0) return null;
  return (
    <Tabs defaultValue="tab-0">
      <TabsList className="flex-wrap">
        {tabs.map((tab, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: tabs have no ids of their own
          <TabsTrigger key={index} value={`tab-${index}`}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: tabs have no ids of their own
        <TabsContent key={index} value={`tab-${index}`} forceMount className="pt-4 data-[state=inactive]:hidden">
          <div className="gf-prose">{tab.content}</div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
