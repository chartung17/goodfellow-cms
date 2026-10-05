import { createSiteLinks } from "./links-shared.js";
import { useSite } from "./site-context.js";

export const { SiteLink, SiteImage } = createSiteLinks(useSite);
