import { describe, expect, it } from "vitest";
import { applyBasePath, normalizeBase } from "./base-path.js";

describe("normalizeBase", () => {
  it.each([
    [undefined, "/"],
    ["", "/"],
    ["/", "/"],
    ["repo", "/repo/"],
    ["/repo", "/repo/"],
    ["/a/b/", "/a/b/"],
  ])("%s → %s", (input, output) => {
    expect(normalizeBase(input)).toBe(output);
  });
});

describe("applyBasePath", () => {
  it("prefixes root-relative links, images and srcsets", () => {
    const html =
      '<a href="/about">a</a><img src="/media/x.png" srcset="/media/x.png 1x, /media/x2.png 2x"/>' +
      '<link rel="stylesheet" href="/assets/s.css"/><video poster="/media/p.jpg"></video>';
    expect(applyBasePath(html, "/repo/")).toBe(
      '<a href="/repo/about">a</a><img src="/repo/media/x.png" srcset="/repo/media/x.png 1x, /repo/media/x2.png 2x"/>' +
        '<link rel="stylesheet" href="/repo/assets/s.css"/><video poster="/repo/media/p.jpg"></video>',
    );
  });

  it("prefixes url() in style attributes", () => {
    expect(applyBasePath('<section style="background-image:url(&quot;/media/bg.jpg&quot;)">', "/repo/")).toBe(
      '<section style="background-image:url(&quot;/repo/media/bg.jpg&quot;)">',
    );
  });

  it("leaves absolute, protocol-relative, fragment and text URLs alone", () => {
    const html =
      '<a href="https://example.org/x">a</a><a href="//cdn.example.org/x">b</a><a href="#top">c</a>' +
      '<meta property="og:url" content="/about"/><p>href="/not-an-attribute"</p>';
    expect(applyBasePath(html, "/repo/")).toBe(html);
  });

  it("does nothing for the root base", () => {
    expect(applyBasePath('<a href="/about">', "/")).toBe('<a href="/about">');
  });
});
