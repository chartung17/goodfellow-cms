"use client";

import { GoodfellowAdmin } from "@goodfellow/next/admin";
import config from "@/goodfellow.config";

export default function AdminPage() {
  return <GoodfellowAdmin config={config} />;
}
