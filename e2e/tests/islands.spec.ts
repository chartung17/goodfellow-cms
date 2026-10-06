import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect as baseExpect, type Page, test } from "@playwright/test";
import { islandsPage, nextSite, site } from "../scripts/site.mjs";

// Client Components in blocks, from fixtures/blocks: the same page under `goodfellow dev`, in a
// production build of the starter (see start-built-site.mjs), and under `next dev`.
const expect = baseExpect.configure({ timeout: 30_000 });
test.describe.configure({ timeout: 90_000 });

const servers = [
  { name: "goodfellow dev", url: "http://localhost:4400/islands", root: site as string },
  { name: "goodfellow build", url: "http://localhost:4401/islands" },
  { name: "next dev", url: "http://localhost:4403/islands/", root: nextSite as string },
];

/**
 * Errors the page logs, such as React's when the browser's HTML doesn't match the server's.
 * Files that fail to load, such as fonts from Google Fonts where tests run offline, are left out.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource"))
      errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/**
 * Clicks a button until it shows that it ran: clicks before a Client Component starts
 * running in the browser do nothing, as on any page rendered on the server.
 */
async function clickUntil(page: Page, button: string, ran: () => Promise<boolean>) {
  await expect(async () => {
    if (!(await ran())) await page.getByRole("button", { name: button, exact: true }).click();
    expect(await ran()).toBe(true);
  }).toPass();
}

for (const server of servers) {
  test.describe(server.name, () => {
    test.beforeEach(() => {
      if (server.root) {
        writeFileSync(join(server.root, "content/pages/islands.json"), `${JSON.stringify(islandsPage, null, 2)}\n`);
      }
    });
    test.afterEach(() => {
      if (server.root) rmSync(join(server.root, "content/pages/islands.json"), { force: true });
    });

    test("runs Client Components in the browser, with the site's data", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(server.url);
      await expect(page.getByText("My site at /islands").first()).toBeVisible();
      await clickUntil(page, "Clicked 0 times", () =>
        page.getByRole("button", { name: "Clicked 1 times" }).isVisible(),
      );
      expect(errors).toEqual([]);
    });

    test("runs Client Components in content passed to another, once it's shown", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(server.url);
      const more = page.getByRole("button", { name: "More", exact: true });
      await expect(page.getByText("Text of More")).toBeHidden();
      await clickUntil(page, "More", () => page.getByText("Text of More").isVisible());
      // useId() gives the same ids in the browser as on the server.
      const controls = await more.getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      await expect(page.locator(`[id="${controls}"]`)).toContainText("Text of More");

      await page.getByRole("button", { name: "More inside 0 times" }).click();
      await expect(page.getByRole("button", { name: "More inside 1 times" })).toBeVisible();
      // Hidden and shown again, the content starts afresh and still runs.
      await more.click();
      await expect(page.getByText("Text of More")).toBeHidden();
      await more.click();
      await page.getByRole("button", { name: "More inside 0 times" }).click();
      await expect(page.getByRole("button", { name: "More inside 1 times" })).toBeVisible();
      expect(errors).toEqual([]);
    });

    test("runs Client Components in content passed to another that shows it at once", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(server.url);
      await expect(page.getByText("Text of Shown")).toBeVisible();
      await clickUntil(page, "Shown inside 0 times", () =>
        page.getByRole("button", { name: "Shown inside 1 times" }).isVisible(),
      );
      await page.getByRole("button", { name: "Shown", exact: true }).click();
      await expect(page.getByText("Text of Shown")).toBeHidden();
      expect(errors).toEqual([]);
    });
  });
}

test("loads no JavaScript on built pages without Client Components", async ({ page }) => {
  await page.goto("http://localhost:4401/about");
  await expect(page.getByRole("heading", { name: "About us", level: 1 })).toBeVisible();
  await expect(page.locator("script")).toHaveCount(0);

  await page.goto("http://localhost:4401/islands");
  await expect(page.locator('script[type="module"]')).toHaveCount(1);
});
