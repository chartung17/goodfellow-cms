import { site } from "../../lib/site";
import "../site.css";

// Only the site's pages exist; any other address shows "Page not found".
export const dynamicParams = false;
export const generateStaticParams = site.generateStaticParams;
export const generateMetadata = site.generateMetadata;
export default site.Page;
