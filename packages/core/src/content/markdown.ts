import { Marked, type Tokens } from "marked";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { CURRENT_VERSION } from "../migrations/index.js";
import type { CollectionFile } from "./schemas.js";

/**
 * Markdown entries: `<slug>.md` files in collections whose settings say
 * `markdown: { body }`. The body field is the Markdown after the front matter,
 * and every other field is in the front matter (YAML), beside `version`:
 *
 *     ---
 *     version: 1
 *     title: Writing blocks
 *     ---
 *
 *     Blocks are React components…
 */

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n?---[ \t]*(?:\r?\n|$)/;

/**
 * Reads a Markdown entry into the same shape as a JSON entry, `{ version, fields }`,
 * with the body under `body`. Throws with a plain message if the file can't be read.
 */
export function parseMarkdownEntry(text: string, body: string): Record<string, unknown> {
  const match = FRONT_MATTER.exec(text);
  if (!match) throw new Error('must start with front matter: a line "---", the fields, then another "---".');
  let front: unknown;
  try {
    front = parseYaml(match[1] ?? "") ?? {};
  } catch (error) {
    throw new Error(`has front matter that isn't valid YAML (${(error as Error).message.split("\n")[0]}).`);
  }
  if (front === null || typeof front !== "object" || Array.isArray(front)) {
    throw new Error("must have front matter that lists fields, such as `title: My page`.");
  }
  const { version, ...fields } = front as Record<string, unknown>;
  const markdown = text
    .slice(match[0].length)
    .replace(/^\r?\n/, "")
    .trimEnd();
  return { version, fields: { ...fields, [body]: markdown } };
}

/**
 * Writes a Markdown entry: `version` and the fields in the collection's order in
 * the front matter (then any others, alphabetically), and the body after it.
 */
export function serializeMarkdownEntry(settings: CollectionFile, fields: Record<string, unknown>): string {
  const body = settings.markdown?.body;
  if (!body) throw new Error("The collection doesn't store its entries as Markdown.");
  const front: Record<string, unknown> = { version: CURRENT_VERSION.entry };
  const known = settings.fields.map((field) => field.name).filter((name) => name !== body);
  const others = Object.keys(fields)
    .filter((name) => name !== body && !known.includes(name))
    .sort();
  for (const name of [...known, ...others]) {
    if (fields[name] !== undefined) front[name] = fields[name];
  }
  const markdown = typeof fields[body] === "string" ? fields[body].trimEnd() : "";
  const yaml = stringifyYaml(front, { lineWidth: 0 });
  return markdown ? `---\n${yaml}---\n\n${markdown}\n` : `---\n${yaml}---\n`;
}

/** A heading in Markdown, with the id its anchor gets. */
export interface MarkdownHeading {
  depth: number;
  text: string;
  id: string;
}

const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => escapes[character] ?? character);
}

/** Addresses that can't run code: the site's own, the web's, email and phone. */
export function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^(?:https?:|mailto:|tel:)/i.test(trimmed)) return true;
  // No scheme at all: relative, root-relative or a fragment. Anything with a colon before the first slash has one.
  return !/^[^/?#]*:/.test(trimmed);
}

/** Lowercase words joined by hyphens, as GitHub makes heading anchors: "Writing blocks" → `writing-blocks`. */
export function headingSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/<[^>]*>/g, "")
      .replace(/&[a-z]+;|&#\d+;/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || "section"
  );
}

/** Gives headings unique ids in document order, numbering repeats: `setup`, `setup-1`. */
function slugger() {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base = headingSlug(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

/** Plain text of inline Markdown tokens, for headings' ids and lists of them. */
function plainText(tokens: Tokens.Generic[] | undefined): string {
  return (tokens ?? [])
    .map((token) => ("tokens" in token && token.tokens ? plainText(token.tokens) : "text" in token ? token.text : ""))
    .join("");
}

/** The headings in Markdown, in order, with the ids `markdownToHtml` gives them. */
export function markdownHeadings(markdown: string): MarkdownHeading[] {
  const slug = slugger();
  const headings: MarkdownHeading[] = [];
  const marked = new Marked({ gfm: true });
  for (const token of marked.lexer(markdown)) {
    if (token.type === "heading") {
      const text = plainText((token as Tokens.Heading).tokens);
      headings.push({ depth: (token as Tokens.Heading).depth, text, id: slug(text) });
    }
  }
  return headings;
}

export interface MarkdownOptions {
  /**
   * Turns a code block into highlighted HTML, or returns `undefined` to show it
   * plain. Its result is used as it is, so it must escape the code itself.
   */
  highlight?(code: string, language: string): string | undefined;
}

/**
 * Turns Markdown, including GitHub's tables and strikethrough, into HTML that's
 * safe to put in a page: HTML in the Markdown is shown as text, and links and
 * images may only use addresses that can't run code. Headings get ids, as
 * `markdownHeadings` lists them, so they can be linked to.
 */
export function markdownToHtml(markdown: string, options: MarkdownOptions = {}): string {
  const slug = slugger();
  const marked = new Marked({ gfm: true, async: false });
  marked.use({
    renderer: {
      html({ text }) {
        return escapeHtml(text);
      },
      heading({ tokens, depth }) {
        const id = slug(plainText(tokens));
        return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        if (!isSafeUrl(href)) return text;
        return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ""}>${text}</a>`;
      },
      image({ href, title, text }) {
        if (!isSafeUrl(href)) return escapeHtml(text);
        return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ""}>`;
      },
      code({ text, lang }) {
        const language = (lang ?? "").trim().split(/\s+/)[0] ?? "";
        const highlighted = options.highlight?.(text, language);
        if (highlighted !== undefined) return `${highlighted}\n`;
        const className = language ? ` class="language-${escapeHtml(language)}"` : "";
        return `<pre><code${className}>${escapeHtml(text)}\n</code></pre>\n`;
      },
    },
  });
  return marked.parse(markdown) as string;
}
