import { describe, expect, it } from "vitest";
import { HeadCodeError, type HeadCodeProblem, parseHeadCode, storedCode } from "./code.js";

function problem(html: string): HeadCodeProblem | undefined {
  try {
    parseHeadCode(html);
    return undefined;
  } catch (error) {
    if (error instanceof HeadCodeError) return error.problem;
    throw error;
  }
}

describe("parseHeadCode", () => {
  it("reads the snippets analytics and verification services give", () => {
    const html = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123&amp;l=dataLayer"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  if (1 < 2) gtag('js', new Date());
</script>
<meta name="google-site-verification" content='abc' />
<link rel=preconnect href="https://example.org" crossorigin>
<style>body { color: red }</style>
<noscript><img src="https://example.org/pixel.gif" alt=""></noscript>`;
    expect(parseHeadCode(html)).toEqual([
      {
        tag: "script",
        attributes: [
          ["async", ""],
          ["src", "https://www.googletagmanager.com/gtag/js?id=G-ABC123&l=dataLayer"],
        ],
        content: "",
      },
      {
        tag: "script",
        attributes: [],
        content:
          "\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  if (1 < 2) gtag('js', new Date());\n",
      },
      {
        tag: "meta",
        attributes: [
          ["name", "google-site-verification"],
          ["content", "abc"],
        ],
      },
      {
        tag: "link",
        attributes: [
          ["rel", "preconnect"],
          ["href", "https://example.org"],
          ["crossorigin", ""],
        ],
      },
      { tag: "style", attributes: [], content: "body { color: red }" },
      { tag: "noscript", attributes: [], content: '<img src="https://example.org/pixel.gif" alt="">' },
    ]);
    expect(parseHeadCode("  \n")).toEqual([]);
  });

  it("refuses what doesn't belong in the head", () => {
    expect(problem("<div>Hello</div>")).toEqual({ code: "tag", tag: "div" });
    expect(problem("Hello <meta charset=utf-8>")).toEqual({ code: "text", text: "Hello" });
    expect(problem("<script>alert(1)")).toEqual({ code: "unclosed", tag: "script" });
    expect(problem('<meta name="a"')).toEqual({ code: "unclosed", tag: "meta" });
    expect(problem("<!-- note")).toEqual({ code: "unclosed", tag: "!--" });
  });
});

describe("storedCode", () => {
  it("ends code with one newline, and saves nothing for none", () => {
    expect(storedCode("<meta name=a>  \n\n")).toBe("<meta name=a>\n");
    expect(storedCode("  \n")).toBe("");
  });
});
