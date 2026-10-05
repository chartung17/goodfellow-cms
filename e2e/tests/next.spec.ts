import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect as baseExpect } from "@playwright/test";
import { nextSite, resetNextContent } from "../scripts/site.mjs";

// The Next.js template under `next dev`: see playwright.config.ts.
const BASE = "http://localhost:4403";

// `next dev` compiles each page the first time it's opened, which can take a while.
const expect = baseExpect.configure({ timeout: 30_000 });

base.describe.configure({ timeout: 90_000 });

const test = base.extend({
  page: async ({ page }, use) => {
    resetNextContent();
    await use(page);
  },
});

test("serves the site's pages, header and footer with Next.js", async ({ page }) => {
  await page.goto(`${BASE}/about/`);
  await expect(page.getByRole("heading", { name: "About us", level: 1 })).toBeVisible();
  await expect(page.locator("header nav").getByRole("link", { name: "News" })).toBeVisible();
  await expect(page).toHaveTitle("About us | My site");
  // Styled by the site's Tailwind build and theme.
  const background = await page
    .locator("footer section")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).not.toBe("rgba(0, 0, 0, 0)");

  await page.goto(`${BASE}/news/welcome/`);
  await expect(page).toHaveTitle("Welcome to our new website | My site");
});

test("shows the site's own page for addresses that don't exist", async ({ page }) => {
  const response = await page.goto(`${BASE}/no-such-page/`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("publishes from the admin panel to the files on disk", async ({ page }) => {
  await page.goto(`${BASE}/admin/#/settings/general`);
  await page.getByLabel("Site name").fill("Next site");
  await expect(page.frameLocator(".gfa-preview iframe").getByText("Next site").first()).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published.", { exact: true })).toBeVisible();

  const settings = JSON.parse(readFileSync(join(nextSite, "content/site.json"), "utf8")) as { title: string };
  expect(settings.title).toBe("Next site");
  await page.goto(`${BASE}/about/`);
  await expect(page.locator("header").getByText("Next site")).toBeVisible();
});

test("edits a page in Puck with the site's styles", async ({ page }) => {
  await page.goto(`${BASE}/admin/#/pages/edit?path=${encodeURIComponent("/about")}`);
  const canvas = page.frameLocator("iframe#preview-frame");
  await expect(canvas.getByRole("heading", { name: "About us" })).toBeVisible();
  const heading = canvas.getByRole("heading", { name: "About us" });
  await expect.poll(() => heading.evaluate((el) => getComputedStyle(el).fontWeight)).toBe("700");
});
