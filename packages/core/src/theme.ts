import { THEME_COLORS, type Theme, type ThemeColor } from "./content/schemas.js";

/** The theme used for anything a site doesn't set. Neutral grays, so any brand color works on top. */
export const DEFAULT_THEME_COLORS: Record<ThemeColor, string> = {
  background: "#ffffff",
  foreground: "#0a0a0a",
  primary: "#171717",
  primaryForeground: "#fafafa",
  secondary: "#f5f5f5",
  secondaryForeground: "#171717",
  muted: "#f5f5f5",
  mutedForeground: "#737373",
  accent: "#f5f5f5",
  accentForeground: "#171717",
  border: "#e5e5e5",
};

export const DEFAULT_RADIUS = "0.5rem";

const FALLBACK_FONTS = "ui-sans-serif, system-ui, sans-serif";

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Makes text safe to place inside a `<style>` element: nothing in it can close
 * the element or open an HTML comment.
 */
export function escapeStyleText(css: string): string {
  return css.replace(/<\/(style)/gi, "<\\/$1").replace(/<!--/g, "\\3c !--");
}

/**
 * The CSS custom properties for a theme, as a `:root` rule. Colors use
 * shadcn's variable names (`--primary`, `--primary-foreground`, …); fonts use
 * `--gf-font-heading` and `--gf-font-body`.
 */
export function themeToCss(theme: Theme): string {
  const declarations = THEME_COLORS.map(
    (name) => `--${kebab(name)}:${theme.colors[name] ?? DEFAULT_THEME_COLORS[name]}`,
  );
  declarations.push(`--radius:${theme.radius ?? DEFAULT_RADIUS}`);
  const { heading, body } = theme.fonts;
  declarations.push(`--gf-font-body:${body ? `"${body}", ${FALLBACK_FONTS}` : FALLBACK_FONTS}`);
  declarations.push(`--gf-font-heading:${heading ? `"${heading}", ${FALLBACK_FONTS}` : "var(--gf-font-body)"}`);
  return escapeStyleText(`:root{${declarations.join(";")}}`);
}

/** The Google Fonts stylesheet for a theme's fonts, or `undefined` if it uses none. */
export function googleFontsUrl(theme: Theme): string | undefined {
  const families = [...new Set([theme.fonts.heading, theme.fonts.body].filter(Boolean))] as string[];
  if (families.length === 0) return undefined;
  const params = families.map((family) => `family=${family.trim().replace(/ +/g, "+")}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
