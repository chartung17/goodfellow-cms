import { createSiteLinks } from "./links-shared.js";
import { useSite } from "./site-context.server.js";

export const { SiteLink, SiteImage } = createSiteLinks(useSite);
