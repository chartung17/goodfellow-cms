import { createRequire } from "node:module";
import { DEV_API_PREFIX } from "@goodfellow-cms/core/node";
import type { Plugin } from "vite";

export const ADMIN_ENTRY = "virtual:goodfellow/admin";
const RESOLVED_ADMIN_ENTRY = `\0${ADMIN_ENTRY}`;

/** Where a built admin page finds the settings `goodfellow build` only knows after bundling. */
export const ADMIN_SETTINGS_GLOBAL = "__GOODFELLOW_ADMIN__";

export interface BuiltAdminSettings {
  previewStylesheets: string[];
  siteUrl: string;
}

export type AdminEntryMode = { mode: "dev"; previewStylesheet: string } | { mode: "build" };

/**
 * The admin panel's entry module: the site's own config (so the editor has the
 * site's blocks), plus what previews need to look like the site.
 * - In development it uses the local backend, which reads and writes files on disk.
 * - In builds it signs in to the config's git backend; the local backend is never included.
 */
export function adminEntryPlugin(configFile: string, entry: AdminEntryMode): Plugin {
  const tailwindBrowser = createRequire(import.meta.url).resolve("@tailwindcss/browser");
  const common = [
    `import config from ${JSON.stringify(configFile)};`,
    `import { mountAdmin } from "@goodfellow-cms/admin";`,
    `import "@puckeditor/core/puck.css";`,
    `import "@goodfellow-cms/admin/styles.css";`,
    `import themeCss from "@goodfellow-cms/react/theme.css?raw";`,
    `import tailwindBrowserUrl from ${JSON.stringify(`${tailwindBrowser}?url`)};`,
    `const element = document.getElementById("gf-admin");`,
  ];
  // Built when first requested: in development the preview stylesheet only exists once the server has started.
  const mount = () =>
    entry.mode === "dev"
      ? [
          `import { localStore } from "@goodfellow-cms/admin/dev";`,
          ...common,
          "mountAdmin(element, {",
          "  config,",
          "  store: localStore(),",
          // The block registry the site's packages include, which the development server serves.
          `  registry: ${JSON.stringify(`${DEV_API_PREFIX}/registry/{name}.json`)},`,
          `  preview: { stylesheets: [${JSON.stringify(entry.previewStylesheet)}], themeCss, tailwindBrowserUrl },`,
          `  siteUrl: "/",`,
          "});",
        ]
      : [
          ...common,
          `const settings = window[${JSON.stringify(ADMIN_SETTINGS_GLOBAL)}];`,
          "mountAdmin(element, {",
          "  config,",
          "  preview: { stylesheets: settings.previewStylesheets, themeCss, tailwindBrowserUrl },",
          "  siteUrl: settings.siteUrl,",
          "});",
        ];

  return {
    name: "goodfellow:admin-entry",
    resolveId: (id) => (id === ADMIN_ENTRY ? RESOLVED_ADMIN_ENTRY : undefined),
    load: (id) => (id === RESOLVED_ADMIN_ENTRY ? mount().join("\n") : undefined),
  };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The admin page. In development Vite adds its own scripts; built pages list the bundled files. */
export function adminHtml(options: {
  scripts: string[];
  stylesheets?: string[];
  settings?: BuiltAdminSettings;
  /** The site's icon, for the tab before the admin panel has loaded the site. */
  icon?: string;
}): string {
  const links = (options.stylesheets ?? []).map((href) => `    <link rel="stylesheet" href="${escapeHtml(href)}" />`);
  const settings = options.settings
    ? [
        // JSON with "<" escaped can't close the script element.
        `    <script>window.${ADMIN_SETTINGS_GLOBAL} = ${JSON.stringify(options.settings).replace(/</g, "\\u003c")};</script>`,
      ]
    : [];
  const scripts = options.scripts.map((src) => `    <script type="module" src="${escapeHtml(src)}"></script>`);
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '    <meta name="robots" content="noindex" />',
    "    <title>Site admin</title>",
    ...(options.icon ? [`    <link rel="icon" href="${escapeHtml(options.icon)}" />`] : []),
    ...links,
    ...settings,
    "  </head>",
    "  <body>",
    '    <div id="gf-admin"></div>',
    ...scripts,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}
