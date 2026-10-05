import { build, preview } from "goodfellow";
import { builtSites, createBuiltSite } from "./site.mjs";

const name = process.argv[2];
const root = createBuiltSite(name);
await build({ root });
await preview({ root, port: builtSites[name].port });
