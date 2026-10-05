import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { resetContent, site } from "../scripts/site.mjs";

/** Every test starts from the starter template's content. */
export const test = base.extend({
  page: async ({ page }, use) => {
    resetContent();
    await use(page);
  },
});

export { expect };

export function readSiteFile(path: string): string {
  return readFileSync(join(site as string, path), "utf8");
}

export function writeSiteFile(path: string, content: string): void {
  writeFileSync(join(site as string, path), content);
}

export function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readSiteFile(path));
}

/** The editor's canvas: the page being edited, inside Puck's iframe. */
export function canvas(page: Page) {
  return page.frameLocator("iframe#preview-frame");
}

/** Opens the editor for a page and waits for its canvas to show it. */
export async function openPageEditor(page: Page, path: string, heading: string) {
  await page.goto(`/admin#/pages/edit?path=${encodeURIComponent(path)}`);
  await expect(canvas(page).getByRole("heading", { name: heading })).toBeVisible();
}

/** A field in Puck's right-hand panel. Puck renders hidden copies of fields, so only visible ones count. */
export function field(page: Page, name: string) {
  return page
    .locator(`.gfa-editor input[name="${name}"]:visible, .gfa-editor textarea[name="${name}"]:visible`)
    .first();
}

export async function publishInEditor(page: Page) {
  await page.locator(".gfa-editor").getByText("Publish", { exact: true }).click();
}
