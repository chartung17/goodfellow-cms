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

test("undoes and redoes changes on every tab, with typing undone as one step", async ({ page }) => {
  await page.goto("/admin#/settings/theme");
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  await expect(undo).toBeDisabled();
  const color = page.getByRole("textbox", { name: "Main color", exact: true });
  const colorBefore = await color.inputValue();
  await color.fill("#7c2d12");

  await page.getByRole("link", { name: "Custom CSS" }).click();
  const css = page.getByRole("textbox", { name: "Custom CSS" });
  const cssBefore = await css.inputValue();
  await css.press("ControlOrMeta+End");
  await css.pressSequentially("h1 { color: red; }");
  await undo.click();
  await expect(css).toHaveValue(cssBefore);

  await page.getByRole("link", { name: "Colors & fonts" }).click();
  await expect(color).toHaveValue("#7c2d12");
  // Outside text fields, the keyboard works too.
  await page.getByRole("heading", { name: "Site settings" }).click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(color).toHaveValue(colorBefore);
  await expect(undo).toBeDisabled();
  await redo.click();
  await expect(color).toHaveValue("#7c2d12");

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published.", { exact: true })).toBeVisible();
  expect(readJson("content/site.json")).toMatchObject({ theme: { colors: { primary: "#7c2d12" } } });
  expect(readSiteFile("content/styles/custom.css")).not.toContain("color: red");
});

test("chooses fonts from a searchable list of Google Fonts", async ({ page }) => {
  await page.goto("/admin#/settings/theme");
  const headings = page.getByRole("combobox", { name: "Headings" });
  await expect(headings).toHaveValue("Fraunces");
  await headings.click();
  await headings.fill("playf");
  await page
    .getByRole("option", { name: /^Playfair Display/ })
    .first()
    .click();
  await expect(headings).toHaveValue("Playfair Display");
  await expect(page.frameLocator(".gfa-preview iframe").getByRole("heading", { name: "Welcome to my site" })).toHaveCSS(
    "font-family",
    /Playfair Display/,
  );

  // The keyboard works as well.
  const text = page.getByRole("combobox", { name: "Text" });
  await text.click();
  await text.fill("Lora");
  await page.keyboard.press("Enter");
  await expect(text).toHaveValue("Lora");

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published.", { exact: true })).toBeVisible();
  expect(readJson("content/site.json")).toMatchObject({
    theme: { fonts: { heading: "Playfair Display", body: "Lora" } },
  });

  // "Site default" takes a font back out.
  await headings.click();
  await page.getByRole("option", { name: /^Site default/ }).click();
  await expect(headings).toHaveValue("Site default");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published.", { exact: true })).toBeVisible();
  expect(readJson("content/site.json")).toMatchObject({ theme: { fonts: { body: "Lora" } } });
  expect(readSiteFile("content/site.json")).not.toContain('"heading"');
});

test("adds the site's own code to every page, but never runs it in the admin panel", async ({ page }) => {
  await page.goto("/admin#/settings/code");
  const head = page.getByRole("textbox", { name: "In the page head" });
  await head.fill("<div>Not for the head</div>");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("alert")).toContainText("Fix the highlighted problems");
  await expect(page.getByText("A <div> tag can't go in the page head.")).toBeVisible();

  await head.fill('<meta name="gf-test" content="yes">\n<script>window.headRan = true;</script>');
  await page
    .getByRole("textbox", { name: "At the end of the page" })
    .fill("<script>window.bodyRan = (window.bodyRan || 0) + 1;</script>");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published.", { exact: true })).toBeVisible();
  expect(readSiteFile("content/code/head.html")).toBe(
    '<meta name="gf-test" content="yes">\n<script>window.headRan = true;</script>\n',
  );
  expect(readSiteFile("content/code/body.html")).toBe("<script>window.bodyRan = (window.bodyRan || 0) + 1;</script>\n");

  // The preview shows the site without its code.
  for (const frame of page.frames()) {
    expect(await frame.evaluate(() => "headRan" in window || "bodyRan" in window)).toBe(false);
  }

  await page.goto("/about");
  await expect(page.locator('head meta[name="gf-test"]')).toHaveAttribute("content", "yes");
  expect(await page.evaluate(() => (window as { headRan?: boolean }).headRan)).toBe(true);
  expect(await page.evaluate(() => (window as { bodyRan?: number }).bodyRan)).toBe(1);
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

test("saves the site's contact details, leaving out empty ones", async ({ page }) => {
  await page.goto("/admin#/settings/general");
  await page.getByLabel("Address", { exact: true }).fill("100 Church Street\nAnytown");
  await page.getByLabel("Phone", { exact: true }).fill("(555) 010-0100");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published.", { exact: true })).toBeVisible();
  expect(readJson("content/site.json")).toMatchObject({
    contact: { address: "100 Church Street\nAnytown", phone: "(555) 010-0100" },
  });
  expect(readSiteFile("content/site.json")).not.toContain('"email"');
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
