import { describe, expect, it } from "vitest";
import { isExternalLink, setLinkTargets } from "./external-links.js";

describe("isExternalLink", () => {
  it("counts addresses on other sites, not the site's own pages, files or email links", () => {
    expect(isExternalLink("https://github.com/someone")).toBe(true);
    expect(isExternalLink("http://example.com")).toBe(true);
    expect(isExternalLink("/about")).toBe(false);
    expect(isExternalLink("/media/flyer.pdf")).toBe(false);
    expect(isExternalLink("mailto:office@example.org")).toBe(false);
    expect(isExternalLink("#top")).toBe(false);
  });

  it("leaves out full addresses on the site's own address", () => {
    expect(isExternalLink("https://example.org/news", "https://example.org")).toBe(false);
    expect(isExternalLink("https://other.example/news", "https://example.org")).toBe(true);
  });
});

describe("setLinkTargets", () => {
  const html =
    '<p><a href="https://github.com">GitHub</a>, <a href="/about">About</a> and <a href="https://example.org/x">ours</a></p>';

  it("opens links to other sites in a new tab when asked, and every other link in the same tab", () => {
    expect(setLinkTargets(html, { newTab: true, siteUrl: "https://example.org" })).toBe(
      '<p><a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>, ' +
        '<a href="/about" target="_self" rel="">About</a> and <a href="https://example.org/x" target="_self" rel="">ours</a></p>',
    );
  });

  it("opens every link in the same tab otherwise", () => {
    expect(setLinkTargets(html, { newTab: false })).not.toContain("_blank");
  });

  it("decodes an address's entities once, as browsers do", () => {
    // `https:&amp;#47;&amp;#47;` is the text `https:&#47;&#47;`, not `https://`.
    expect(setLinkTargets('<a href="https:&amp;#47;&amp;#47;a.example">A</a>', { newTab: true })).toContain(
      'target="_self"',
    );
    expect(setLinkTargets('<a href="https:&#47;&#47;a.example">A</a>', { newTab: true })).toContain('target="_blank"');
  });

  it("keeps a link's own target and rel", () => {
    expect(setLinkTargets('<a href="https://a.example" target="_blank">A</a>', { newTab: false })).toBe(
      '<a href="https://a.example" target="_blank">A</a>',
    );
    expect(setLinkTargets('<a rel="nofollow" href="https://a.example">A</a>', { newTab: true })).toBe(
      '<a rel="nofollow" href="https://a.example" target="_blank">A</a>',
    );
  });
});
