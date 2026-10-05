import { describe, expect, it } from "vitest";
import { siteSettingsSchema } from "./content/schemas.js";
import { escapeStyleText, googleFontsUrl, themeToCss } from "./theme.js";

const theme = (input: object) => siteSettingsSchema.parse({ version: 1, theme: input }).theme;

describe("themeToCss", () => {
  it("fills in defaults and uses shadcn variable names", () => {
    const css = themeToCss(theme({ colors: { primary: "#1e3a8a", primaryForeground: "white" } }));
    expect(css).toMatch(/^:root\{/);
    expect(css).toContain("--primary:#1e3a8a;");
    expect(css).toContain("--primary-foreground:white;");
    expect(css).toContain("--background:#ffffff;");
    expect(css).toContain("--radius:0.5rem;");
    expect(css).toContain("--gf-font-heading:var(--gf-font-body)");
  });

  it("uses the theme's fonts with fallbacks", () => {
    const css = themeToCss(theme({ fonts: { heading: "Cinzel", body: "Lato" } }));
    expect(css).toContain('--gf-font-heading:"Cinzel", ui-sans-serif');
    expect(css).toContain('--gf-font-body:"Lato", ui-sans-serif');
  });
});

describe("googleFontsUrl", () => {
  it("requests each font once", () => {
    expect(googleFontsUrl(theme({ fonts: { heading: "Cinzel Decorative", body: "Cinzel Decorative" } }))).toBe(
      "https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;500;600;700&display=swap",
    );
  });

  it("returns nothing without fonts", () => {
    expect(googleFontsUrl(theme({}))).toBeUndefined();
  });
});

describe("escapeStyleText", () => {
  it("prevents closing the style element", () => {
    const escaped = escapeStyleText("a{} </style><script>alert(1)</script> </STYLE> <!--");
    expect(escaped).not.toMatch(/<\/style/i);
    expect(escaped).not.toContain("<!--");
  });
});
