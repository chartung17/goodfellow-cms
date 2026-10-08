import { markdownToHtml } from "@goodfellow/core";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

let service: TurndownService | undefined;

/** Converts the formatted editor's HTML to Markdown, in the style most Markdown is written in. */
export function htmlToMarkdown(html: string): string {
  if (!service) {
    service = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
      strongDelimiter: "**",
      hr: "---",
    });
    service.use(gfm);
    // Markdown has no underline, and the formatted editor's alignment can't be kept either: keep the text.
    service.addRule("underline", { filter: ["u"], replacement: (content) => content });
    service.addRule("strikethrough", { filter: ["del", "s"], replacement: (content) => `~~${content}~~` });
    // "- item" rather than turndown's "-   item", with what's inside an item indented under it.
    service.addRule("listItem", {
      filter: "li",
      replacement(content, node) {
        const parent = node.parentNode as HTMLElement | null;
        let marker = "- ";
        if (parent?.nodeName === "OL") {
          const start = Number(parent.getAttribute("start") ?? "1");
          marker = `${start + Array.prototype.indexOf.call(parent.children, node)}. `;
        }
        const indent = " ".repeat(marker.length);
        const text = content.replace(/^\n+/, "").replace(/\n+$/, "").replace(/\n/g, `\n${indent}`);
        return `${marker}${text}${node.nextSibling ? "\n" : ""}`;
      },
    });
  }
  return service
    .turndown(html)
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/** The HTML the formatted editor starts from for some Markdown. */
export function formattedHtml(markdown: string): string {
  return markdownToHtml(markdown);
}

/**
 * The Markdown to save after the formatted editor changed `html`. If the text
 * is the same as `original`'s, only written differently (the formatted editor
 * tidies what it loads), `original` is kept, so the file isn't rewritten.
 */
export function editedMarkdown(original: string, html: string): string {
  const edited = htmlToMarkdown(html);
  return edited === htmlToMarkdown(formattedHtml(original)) ? original : edited;
}
