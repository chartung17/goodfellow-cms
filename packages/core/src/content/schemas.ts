import { z } from "zod";
import { addressPatternProblem } from "./paths.js";

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

/** The kinds of information an entry can hold. */
export const FIELD_TYPES = ["text", "textarea", "richtext", "number", "date", "link", "image", "select"] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** A field's name, which also makes its placeholder: `speaker` → `{speaker}`. */
const fieldName = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, "must use lowercase letters, numbers and hyphens, starting with a letter");

const fieldOption = z.object({
  value: z.string().min(1),
  label: z.string(),
});

const collectionField = z.object({
  name: fieldName,
  label: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  /** Entries can't be published with this field empty. */
  required: z.boolean().optional(),
  /** Help shown under the field when editing an entry. */
  hint: z.string().optional(),
  /** The choices for a `select` field. */
  options: z.array(fieldOption).optional(),
});

export type CollectionField = z.output<typeof collectionField>;
export type FieldOption = z.output<typeof fieldOption>;

/** Every collection has a title field, used for entries' names in lists and in the admin panel. */
export const TITLE_FIELD = "title";

export const collectionFileSchema = z
  .object({
    version: z.literal(1),
    /** What the collection is called, such as "Videos". */
    name: z.string().min(1),
    /** What one entry is called, such as "Video". */
    entryName: z.string().min(1),
    /**
     * The address of each entry's page, such as `/videos/{slug}`. Collections
     * without one have no pages of their own and are only shown in lists.
     */
    path: z.string().optional(),
    fields: z.array(collectionField).min(1),
    /** How entries are ordered in the admin panel and, by default, in lists. Defaults to by title. */
    sort: z.object({ field: fieldName, order: z.enum(["asc", "desc"]) }).optional(),
    /** The Puck layout every entry's page uses. */
    template: puckDataSchema.default({ root: {}, content: [] }),
  })
  .superRefine((file, ctx) => {
    const names = new Set<string>();
    file.fields.forEach((field, index) => {
      if (names.has(field.name)) {
        ctx.addIssue({ code: "custom", path: ["fields", index, "name"], message: `is used by more than one field` });
      }
      names.add(field.name);
      if (field.type === "select" && !field.options?.length) {
        ctx.addIssue({ code: "custom", path: ["fields", index, "options"], message: "must list at least one choice" });
      }
    });
    const title = file.fields.find((field) => field.name === TITLE_FIELD);
    if (title?.type !== "text") {
      ctx.addIssue({ code: "custom", path: ["fields"], message: `must include a text field named "${TITLE_FIELD}"` });
    }
    if (file.path !== undefined) {
      const problem = addressPatternProblem(file.path);
      if (problem) ctx.addIssue({ code: "custom", path: ["path"], message: problem });
    }
    if (file.sort && !names.has(file.sort.field)) {
      ctx.addIssue({ code: "custom", path: ["sort", "field"], message: "must be one of the collection's fields" });
    }
  });

export type CollectionFile = z.output<typeof collectionFileSchema>;

/** One entry: its field values, keyed by field name. Checked against its collection's fields when loaded. */
export const entryFileSchema = z.object({
  version: z.literal(1),
  fields: z.record(z.string(), z.unknown()).default({}),
});

export type EntryFile = z.output<typeof entryFileSchema>;
