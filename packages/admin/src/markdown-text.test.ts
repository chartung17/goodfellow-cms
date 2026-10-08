import { describe, expect, it } from "vitest";
import { editedMarkdown, formattedHtml, htmlToMarkdown } from "./markdown-text.js";

describe("Markdown from the formatted editor", () => {
  it("writes the formatted editor's HTML as Markdown", () => {
    expect(
      htmlToMarkdown(
        '<h2>Set up</h2><p>Some <strong>bold</strong>, <em>italic</em> and <u>underlined</u> text, <s>gone</s>, <code>code</code> and <a href="/a">a link</a>.</p><ul><li><p>one</p></li><li><p>two</p><ol><li><p>sub</p></li></ol></li></ul><pre><code class="language-ts">const a = 1;</code></pre>',
      ),
    ).toBe(
      "## Set up\n\nSome **bold**, *italic* and underlined text, ~~gone~~, `code` and [a link](/a).\n\n- one\n- two\n\n  1. sub\n\n```ts\nconst a = 1;\n```",
    );
  });

  it("keeps the original Markdown when only its spelling would change", () => {
    const original = "Some __bold__ text\n\n* one\n* two";
    expect(editedMarkdown(original, formattedHtml(original))).toBe(original);
    expect(editedMarkdown(original, "<p>Some <strong>bold</strong> text!</p>")).toBe("Some **bold** text!");
  });
});
