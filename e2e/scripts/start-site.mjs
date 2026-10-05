import { dev } from "goodfellow";
import { createSite, site } from "./site.mjs";

createSite();
await dev({ root: site, port: Number(process.argv[2] ?? 4400) });
