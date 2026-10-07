import type { HighlighterCore } from "shiki/core";

/** The languages code can be highlighted as, by Shiki's name, with what the editor calls them. */
export const CODE_LANGUAGES = {
  text: "Plain text",
  bash: "Terminal (Bash)",
  css: "CSS",
  diff: "Changes (diff)",
  html: "HTML",
  javascript: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  markdown: "Markdown",
  python: "Python",
  tsx: "TSX",
  typescript: "TypeScript",
  yaml: "YAML",
} as const;

export type CodeLanguage = keyof typeof CODE_LANGUAGES;

/** Other names code blocks in Markdown use for the same languages. */
const ALIASES: Record<string, CodeLanguage> = {
  sh: "bash",
  shell: "bash",
  shellscript: "bash",
  zsh: "bash",
  console: "bash",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  md: "markdown",
  yml: "yaml",
  py: "python",
  plaintext: "text",
  txt: "text",
};

export type CodeColors = "light" | "dark";

const THEMES: Record<CodeColors, string> = { light: "github-light", dark: "github-dark" };

/** The language a name means, such as `ts` → `typescript`, or `undefined` if it isn't one Goodfellow highlights. */
export function codeLanguage(name: string): CodeLanguage | undefined {
  const key = name.toLowerCase();
  if (key in CODE_LANGUAGES) return key as CodeLanguage;
  return ALIASES[key];
}

let highlighter: Promise<HighlighterCore> | undefined;

/**
 * Loads the highlighter the first time code needs it. Shiki and its grammars are
 * only loaded by builds and the editor, never by visitors, who get highlighted HTML.
 */
export function loadHighlighter(): Promise<HighlighterCore> {
  highlighter ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);
    return createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      themes: [import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark.mjs")],
      langs: [
        import("shiki/langs/bash.mjs"),
        import("shiki/langs/css.mjs"),
        import("shiki/langs/diff.mjs"),
        import("shiki/langs/html.mjs"),
        import("shiki/langs/javascript.mjs"),
        import("shiki/langs/json.mjs"),
        import("shiki/langs/jsx.mjs"),
        import("shiki/langs/markdown.mjs"),
        import("shiki/langs/python.mjs"),
        import("shiki/langs/tsx.mjs"),
        import("shiki/langs/typescript.mjs"),
        import("shiki/langs/yaml.mjs"),
      ],
    });
  })();
  highlighter.catch(() => {
    highlighter = undefined;
  });
  return highlighter;
}

/**
 * Highlighted HTML for some code: a `<pre>` whose colors are inline styles.
 * Shiki escapes the code, so the HTML is safe to put in a page.
 */
export function highlightCode(
  shiki: HighlighterCore,
  code: string,
  language: string,
  colors: CodeColors = "light",
): string {
  const lang = codeLanguage(language) ?? "text";
  return shiki.codeToHtml(code, { lang, theme: THEMES[colors] });
}
