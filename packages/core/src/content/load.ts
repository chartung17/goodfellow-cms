import type { z } from "zod";
import { type ContentKind, migrateContent } from "../migrations/index.js";
import { ContentError, type ContentProblem } from "./errors.js";
import {
  CUSTOM_CSS_FILE,
  FOOTER_FILE,
  HEADER_FILE,
  isReservedPagePath,
  MENUS_FILE,
  PAGES_DIR,
  pageFileToPath,
  SITE_FILE,
} from "./paths.js";
import {
  type LayoutFile,
  layoutFileSchema,
  type Menus,
  menusFileSchema,
  type PageFile,
  pageFileSchema,
  type SiteSettings,
  siteSettingsSchema,
} from "./schemas.js";

/**
 * Read access to a site's files. Implemented by the local file system during
 * builds and, later, by each git backend.
 */
export interface ContentSource {
  /** Returns a file's text, or `undefined` if it doesn't exist. Paths are repo-relative. */
  read(path: string): Promise<string | undefined>;
  /** Lists every file under a directory, recursively, as repo-relative paths. Returns `[]` if the directory doesn't exist. */
  list(dir: string): Promise<string[]>;
}

export interface Page {
  /** The URL path, such as `/` or `/about`. */
  path: string;
  /** The content file it came from. */
  file: string;
  content: PageFile;
}

export interface SiteContent {
  settings: SiteSettings;
  menus: Menus;
  header: LayoutFile;
  footer: LayoutFile;
  /** Pages sorted by path. */
  pages: Page[];
  /** Admin-written CSS, or `""`. */
  customCss: string;
}

const EMPTY_LAYOUT: LayoutFile = { version: 1, data: { root: {}, content: [] } };

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => (issue.path.length ? `${issue.path.join(".")} ${issue.message}` : issue.message))
    .join("; ");
}

/**
 * Parses one content file: JSON, then migration to the current version, then
 * validation. Returns the problem instead of throwing so callers can report
 * every bad file at once.
 */
export function parseContentFile<S extends z.ZodType>(
  kind: ContentKind,
  schema: S,
  file: string,
  text: string,
): { ok: true; value: z.output<S> } | { ok: false; problem: ContentProblem } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, problem: { file, message: `isn't valid JSON (${(error as Error).message}).` } };
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, problem: { file, message: "must contain a JSON object." } };
  }

  let migrated: Record<string, unknown>;
  try {
    migrated = migrateContent(kind, raw as Record<string, unknown>);
  } catch (error) {
    return { ok: false, problem: { file, message: (error as Error).message } };
  }

  const result = schema.safeParse(migrated);
  if (!result.success) {
    return { ok: false, problem: { file, message: formatIssues(result.error) } };
  }
  return { ok: true, value: result.data };
}

/** Loads and validates everything under `content/`. Throws a `ContentError` listing every problem found. */
export async function loadSiteContent(source: ContentSource): Promise<SiteContent> {
  const problems: ContentProblem[] = [];

  async function loadOptional<S extends z.ZodType>(
    kind: ContentKind,
    schema: S,
    file: string,
    fallback: z.output<S>,
  ): Promise<z.output<S>> {
    const text = await source.read(file);
    if (text === undefined) return fallback;
    const result = parseContentFile(kind, schema, file, text);
    if (result.ok) return result.value;
    problems.push(result.problem);
    return fallback;
  }

  const [settings, menusFile, header, footer, customCss, pageFiles] = await Promise.all([
    loadOptional("site", siteSettingsSchema, SITE_FILE, siteSettingsSchema.parse({ version: 1 })),
    loadOptional("menus", menusFileSchema, MENUS_FILE, { version: 1, menus: {} }),
    loadOptional("layout", layoutFileSchema, HEADER_FILE, EMPTY_LAYOUT),
    loadOptional("layout", layoutFileSchema, FOOTER_FILE, EMPTY_LAYOUT),
    source.read(CUSTOM_CSS_FILE),
    source.list(PAGES_DIR),
  ]);

  const pages: Page[] = [];
  const filesByPath = new Map<string, string>();

  await Promise.all(
    pageFiles
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        let path: string;
        try {
          path = pageFileToPath(file);
        } catch (error) {
          problems.push({ file, message: (error as Error).message });
          return;
        }

        if (isReservedPagePath(path)) {
          problems.push({ file, message: `can't be used: ${path} is reserved for the admin panel. Rename the file.` });
          return;
        }

        const existing = filesByPath.get(path);
        if (existing) {
          const [first, second] = [existing, file].sort();
          problems.push({
            file: second ?? file,
            message: `serves the same address (${path}) as ${first}. Remove one of them.`,
          });
          return;
        }
        filesByPath.set(path, file);

        const text = await source.read(file);
        if (text === undefined) return;
        const result = parseContentFile("page", pageFileSchema, file, text);
        if (result.ok) pages.push({ path, file, content: result.value });
        else problems.push(result.problem);
      }),
  );

  if (problems.length > 0) {
    problems.sort((a, b) => a.file.localeCompare(b.file));
    throw new ContentError(problems);
  }

  pages.sort((a, b) => a.path.localeCompare(b.path));
  return { settings, menus: menusFile.menus, header, footer, pages, customCss: customCss ?? "" };
}
