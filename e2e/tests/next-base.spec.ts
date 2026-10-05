import { expect as baseExpect, test } from "@playwright/test";

// A production build of the Next.js template served from /site/: see playwright.config.ts.
const SITE = "http://localhost:4404/site";
const expect = baseExpect.configure({ timeout: 15_000 });

test("serves every page, style and image from the base path", async ({ page }) => {
  await page.goto(`${SITE}/about/`);
  await expect(page.getByRole("heading", { name: "About us", level: 1 })).toBeVisible();
  await expect(page).toHaveTitle("About us | My site");

  const background = await page
    .locator("footer section")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  for (const image of await page.locator("main img, header img").all()) {
    await expect(image).toHaveAttribute("src", /^\/site\/media\//);
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  }
  // Links in rich text, as well as in blocks.
  for (const link of await page.locator("main .gf-prose a[href^='/']").all()) {
    await expect(link).toHaveAttribute("href", /^\/site\//);
  }
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/site/media/favicon.svg");
});

test("moves between pages with next/link", async ({ page }) => {
  await page.goto(`${SITE}/`);
  await page.evaluate(() => {
    (window as { notReloaded?: boolean }).notReloaded = true;
  });
  await page.locator("header nav").getByRole("link", { name: "News" }).click();
  await expect(page.getByRole("heading", { name: "News", level: 1 })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/site/news/");
  expect(await page.evaluate(() => (window as { notReloaded?: boolean }).notReloaded)).toBe(true);
});

test("shows the site's own page for addresses that don't exist", async ({ page }) => {
  const response = await page.goto(`${SITE}/no-such-page/`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("includes the admin panel, which explains that it isn't set up yet", async ({ page }) => {
  await page.goto(`${SITE}/admin/`);
  await expect(page.getByText("don't say where the site is stored", { exact: false })).toBeVisible();
});
