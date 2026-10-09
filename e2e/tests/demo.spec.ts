import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { builtSites } from "../scripts/site.mjs";

// A production build of the starter with `demo: true`. Each test has a browser of its own, so it starts afresh.
const DEMO = `http://localhost:${builtSites.demo.port}`;

const svg = (text: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><text y="15">${text}</text></svg>`);

async function siteName(page: Page) {
  await page.goto(`${DEMO}/admin/#/settings/general`);
  return page.getByLabel("Site name");
}

test("opens to anyone without signing in, and keeps their changes in their own browser", async ({ page }) => {
  const outside: string[] = [];
  // Every request that left the demo's own address.
  page.on("request", (request) => {
    if (!request.url().startsWith(DEMO)) outside.push(request.url());
  });

  const name = await siteName(page);
  await expect(page.getByRole("note").filter({ hasText: "This is a demo." })).toBeVisible();
  await expect(name).toHaveValue("My site");
  await name.fill("Visitor's site");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Saved in this browser.", { exact: true })).toBeVisible();

  // Still there after reloading, and the live site hasn't changed.
  await page.reload();
  await expect(page.getByLabel("Site name")).toHaveValue("Visitor's site");
  expect(await (await page.request.get(`${DEMO}/about/`)).text()).toContain("<title>About us | My site</title>");

  // Pages that publish as soon as they're made work too.
  await page.goto(`${DEMO}/admin/#/pages`);
  await page.getByRole("button", { name: "New page" }).click();
  await page.getByLabel("Page title").fill("Try it");
  await page.getByRole("button", { name: "Create page" }).click();
  await expect(page).toHaveURL(/#\/pages\/edit\?path=%2Ftry-it$/);
  await page.goto(`${DEMO}/admin/#/pages`);
  await page.reload();
  await expect(page.getByText("/try-it", { exact: true })).toBeVisible();

  // Nothing went to a git host.
  expect(outside.filter((url) => /github|gitlab/.test(new URL(url).hostname))).toEqual([]);
});

test("keeps uploads in the browser, and starts over", async ({ page }) => {
  await page.goto(`${DEMO}/admin/#/media`);
  await page
    .locator('input[type="file"][aria-label="Upload files"]')
    .first()
    .setInputFiles({ name: "badge.svg", mimeType: "image/svg+xml", buffer: svg("Hi") });
  await expect(page.locator(".gfa-media-name", { hasText: "badge.svg" })).toBeVisible();

  // The live site doesn't have it, so it's shown from the browser's copy, even after reloading.
  await page.reload();
  const image = page.locator(".gfa-media-card", { hasText: "badge.svg" }).locator("img");
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(40);
  expect((await page.request.get(`${DEMO}/media/badge.svg`)).status()).toBe(404);

  const name = await siteName(page);
  await name.fill("Changed");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Saved in this browser.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start over" }).click();
  await expect(page.getByLabel("Site name")).toHaveValue("My site");
  await page.goto(`${DEMO}/admin/#/media`);
  await expect(page.locator(".gfa-media-name", { hasText: "logo.svg" })).toBeVisible();
  await expect(page.locator(".gfa-media-name", { hasText: "badge.svg" })).toBeHidden();
});

// The admin panel lists blocks from the registry's release on jsDelivr; tests serve the built registry instead.
const registryDir = fileURLToPath(new URL("../node_modules/@goodfellow-cms/registry/r/", import.meta.url));

test("lists the blocks there are, but doesn't add or remove them", async ({ page }) => {
  await page.route(
    /^https:\/\/cdn\.jsdelivr\.net\/npm\/@goodfellow-cms\/registry@[^/]+\/r\/([a-z0-9-]+\.json)$/,
    (route) =>
      route.fulfill({
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: readFileSync(join(registryDir, new URL(route.request().url()).pathname.split("/").at(-1) ?? ""), "utf8"),
      }),
  );
  await page.goto(`${DEMO}/admin/#/blocks`);
  await expect(
    page.getByRole("note").filter({ hasText: "In this demo you can see which blocks there are" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add FAQ" })).toBeDisabled();
});
