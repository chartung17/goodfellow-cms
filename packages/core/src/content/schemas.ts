import { z } from "zod";

/** Theme color names. They map to shadcn-compatible CSS variables (`primaryForeground` → `--primary-foreground`). */
export const THEME_COLORS = [
  "background",
  "foreground",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "muted",
  "mutedForeground",
  "accent",
  "accentForeground",
  "border",
] as const;

export type ThemeColor = (typeof THEME_COLORS)[number];

/**
 * A CSS color such as `#1e3a8a`, `rgb(30 58 138)` or `oklch(0.4 0.1 260)`.
 * Restricted to characters colors actually use, so a value can't break out of
 * the stylesheet it's written into.
 */
const cssColor = z
  .string()
  .regex(/^[#a-zA-Z0-9(),.%\s/+-]{1,100}$/, "must be a CSS color, such as #1e3a8a or rgb(30 58 138)");

/** A Google Fonts family name, such as `Inter` or `Cinzel Decorative`. */
const fontFamily = z.string().regex(/^[a-zA-Z0-9 ]{1,60}$/, "must be a font name, such as Inter or Cinzel Decorative");

/** A CSS length, such as `0.5rem` or `0`. */
const cssLength = z.string().regex(/^\d*\.?\d+(px|rem|em)?$/, "must be a size, such as 0.5rem or 8px");

const themeSchema = z.object({
  colors: z.partialRecord(z.enum(THEME_COLORS), cssColor).default({}),
  fonts: z
    .object({
      heading: fontFamily.optional(),
      body: fontFamily.optional(),
    })
    .default({}),
  radius: cssLength.optional(),
});

export const siteSettingsSchema = z.object({
  version: z.literal(1),
  title: z.string().default("My site"),
  description: z.string().default(""),
  /** The site's public address, such as `https://example.org`. Used for the sitemap and link previews. */
  url: z.url({ protocol: /^https?$/ }).optional(),
  language: z.string().default("en"),
  favicon: z.string().optional(),
  logo: z
    .object({
      src: z.string(),
      alt: z.string().default(""),
    })
    .optional(),
  /** How page titles appear in browser tabs. `%s` is replaced by the page title. */
  titleTemplate: z.string().default("%s"),
  /** Image shown when a page is shared on social media, unless the page sets its own. */
  socialImage: z.string().optional(),
  theme: themeSchema.default({ colors: {}, fonts: {} }),
});

export type SiteSettings = z.output<typeof siteSettingsSchema>;
export type Theme = SiteSettings["theme"];

const menuLink = z.object({
  label: z.string(),
  href: z.string(),
});

const menuItem = menuLink.extend({
  children: z.array(menuLink).optional(),
});

export const menusFileSchema = z.object({
  version: z.literal(1),
  menus: z.record(z.string(), z.array(menuItem)).default({}),
});

export type MenusFile = z.output<typeof menusFileSchema>;
export type Menus = MenusFile["menus"];
export type MenuItem = z.output<typeof menuItem>;

const componentData = z.looseObject({
  type: z.string().min(1),
  props: z.looseObject({ id: z.string().min(1) }),
});

/** Puck page data. Only the outline is checked here; blocks validate their own props. */
export const puckDataSchema = z.looseObject({
  root: z.looseObject({ props: z.record(z.string(), z.unknown()).optional() }).default({}),
  content: z.array(componentData).default([]),
});

export const pageFileSchema = z.object({
  version: z.literal(1),
  data: puckDataSchema,
});

export type PageFile = z.output<typeof pageFileSchema>;

/** The header and footer use the same format as pages. */
export const layoutFileSchema = pageFileSchema;
export type LayoutFile = PageFile;
