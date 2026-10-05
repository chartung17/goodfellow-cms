import { canvas, expect, publishInEditor, readJson, readSiteFile, test, writeSiteFile } from "./helpers.js";

test("edits and publishes the header", async ({ page }) => {
  await page.goto("/admin#/layout/header");
  await expect(canvas(page).getByRole("link", { name: "My site" })).toBeVisible();
  // Puck covers each block with a draggable handle; clicking it selects the block.
  await canvas(page).locator('[data-puck-component="SiteBrand-header"]').click();
  await page.locator(".gfa-editor").getByRole("radio", { name: "Name only" }).check({ force: true });
  await publishInEditor(page);

  await expect(page.getByText("Published.", { exact: true })).toBeVisible();
  expect(readSiteFile("content/layout/header.json")).toContain('"show": "title"');
});

test("switches between the header and footer", async ({ page }) => {
  await page.goto("/admin#/layout/header");
  await page.locator(".gfa-tabs").getByRole("link", { name: "Footer" }).click();
  await expect(canvas(page).getByText("Built with Goodfellow.")).toBeVisible();
});

test("previews theme changes and custom CSS before publishing, then publishes them together", async ({ page }) => {
  await page.goto("/admin#/settings/theme");
  const preview = page.frameLocator(".gfa-preview iframe");
  await expect(preview.getByRole("heading", { name: "Welcome to my site" })).toBeVisible();

  await page.getByRole("textbox", { name: "Main color", exact: true }).fill("#7c2d12");
  await expect(preview.locator("main section").first()).toHaveCSS("background-color", "rgb(124, 45, 18)");

  await page.getByRole("link", { name: "Custom CSS" }).click();
  await page.getByRole("textbox", { name: "Custom CSS" }).fill(".gf-main h2 { @apply italic; }");
  await expect(preview.getByRole("heading", { name: "Everything in one place" })).toHaveCSS("font-style", "italic");

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published.", { exact: true })).toBeVisible();
  expect(readJson("content/site.json")).toMatchObject({ theme: { colors: { primary: "#7c2d12" } } });
  expect(readSiteFile("content/styles/custom.css")).toBe(".gf-main h2 { @apply italic; }\n");
});

test("won't publish invalid settings", async ({ page }) => {
  await page.goto("/admin#/settings/general");
  const before = readSiteFile("content/site.json");
  await page.getByLabel("Site address").fill("not a web address");
  await page.getByRole("button", { name: "Publish" }).click();

  await expect(page.getByRole("alert")).toContainText("Fix the highlighted problems");
  await expect(page.getByLabel("Site address")).toHaveAttribute("aria-invalid", "true");
  expect(readSiteFile("content/site.json")).toBe(before);
});

test("adds a link to a menu", async ({ page }) => {
  await page.goto("/admin#/settings/menus");
  await page.getByRole("tab", { name: "main" }).click();
  await page.getByRole("button", { name: "Add link", exact: true }).click();
  await page.getByLabel("Label").last().fill("Contact");
  await page.getByLabel("Link to").last().fill("/contact");
  await expect(page.frameLocator(".gfa-preview iframe").getByRole("link", { name: "Contact" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published.", { exact: true })).toBeVisible();
  const menus = readJson("content/menus.json") as { menus: { main: Array<{ label: string; href: string }> } };
  expect(menus.menus.main.at(-1)).toEqual({ label: "Contact", href: "/contact" });
});

test("shows a clear message when content files have problems", async ({ page }) => {
  writeSiteFile("content/pages/broken.json", "{ not json");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "The admin panel couldn't open this site" })).toBeVisible();
  await page.getByText("Details").click();
  await expect(page.getByText(/content\/pages\/broken\.json: isn't valid JSON/)).toBeVisible();
});

test("isn't reachable from other websites", async ({ request }) => {
  expect((await request.get("/__goodfellow/api/revision")).status()).toBe(403);
  const crossSite = await request.get("/__goodfellow/api/revision", {
    headers: { "x-goodfellow-request": "1", origin: "https://evil.example" },
  });
  expect(crossSite.status()).toBe(403);
  const outside = await request.get("/__goodfellow/api/file?path=goodfellow.config.tsx", {
    headers: { "x-goodfellow-request": "1" },
  });
  expect(outside.status()).toBe(400);
});
