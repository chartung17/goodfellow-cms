import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fakeGitHub } from "@goodfellow/github/testing";
import { expect as baseExpect, test as baseTest, type Page } from "@playwright/test";
import { nextSite, resetNextContent, site } from "../scripts/site.mjs";
import { files, GITHUB_SITE, routeToFake } from "./backends.js";
import { test, waitForCode, writeSiteFile } from "./helpers.js";

// Adding a block rebuilds the dev server's modules, so allow for that.
const expect = baseExpect.configure({ timeout: 30_000 });

const faqPage = {
  version: 1,
  data: {
    content: [
      {
        type: "shadcn-faq",
        props: {
          id: "shadcn-faq-1",
          className: "",
          title: "Common questions",
          questions: [{ question: "When are you open?", answer: "<p>Every day but Monday.</p>" }],
        },
      },
    ],
    root: { props: { className: "", description: "", image: "", title: "Help" } },
  },
};

const onDisk = (path: string) => existsSync(join(site as string, path));

/** Publishes the blocks marked to add or remove, all together. */
async function publishBlocks(page: Page) {
  await page.getByRole("region", { name: "Changes to publish" }).getByRole("button", { name: "Publish" }).click();
}

async function addFaq(page: Page) {
  await page.goto("/admin#/blocks");
  await expect(page.getByRole("heading", { name: "Interactive" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "FAQ" }).getByText("Recommended")).toBeVisible();
  // The dev server reloads the admin panel once the block's code is on disk, which clears this.
  await page.evaluate(() => Object.assign(window, { beforeAdding: true }));
  await page.getByRole("button", { name: "Add FAQ" }).click();
  await publishBlocks(page);
  await expect.poll(() => onDisk("blocks/installed/installed.json")).toBe(true);
  await expect.poll(() => page.evaluate(() => "beforeAdding" in window).catch(() => true)).toBe(false);
}

test("adds a block from Goodfellow's registry, which the editor then offers and the site runs", async ({ page }) => {
  await addFaq(page);
  for (const path of [
    "blocks/installed/shadcn-faq/block.tsx",
    "blocks/installed/shadcn-faq/faq-list.tsx",
    "components/ui/accordion.tsx",
  ]) {
    expect(onDisk(path), path).toBe(true);
  }
  expect(readFileSync(join(site as string, "blocks/installed/index.ts"), "utf8")).toContain('"shadcn-faq": block0');

  await page.goto("/admin#/blocks");
  const added = page.locator(".gfa-block-list");
  await expect(added).toContainText("FAQ");
  await expect(page.getByRole("button", { name: "Add FAQ" })).toBeHidden();

  // The editor offers it, in its own group.
  await page.goto(`/admin#/pages/edit?path=${encodeURIComponent("/about")}`);
  await expect(page.locator(".gfa-editor").getByText("FAQ", { exact: true }).first()).toBeVisible();

  // And it runs on the site: answers open when their question is clicked.
  writeSiteFile("content/pages/help.json", `${JSON.stringify(faqPage, null, 2)}\n`);
  await page.goto("/help");
  const answer = page.getByText("Every day but Monday.");
  await expect(answer).toBeHidden();
  await expect(async () => {
    if (!(await answer.isVisible())) await page.getByRole("button", { name: "When are you open?" }).click();
    baseExpect(await answer.isVisible()).toBe(true);
  }).toPass({ timeout: 30_000 });
});

test("won't remove a block that's in use, and removes it once it isn't", async ({ page }) => {
  await addFaq(page);
  writeSiteFile("content/pages/help.json", `${JSON.stringify(faqPage, null, 2)}\n`);

  // Loads the site again, with the new page.
  await page.reload();
  await page.getByRole("button", { name: "Remove FAQ" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("FAQ is used in: Help (/help)");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("region", { name: "Changes to publish" })).toBeHidden();

  rmSync(join(site as string, "content/pages/help.json"));
  await page.reload();
  await page.getByRole("button", { name: "Remove FAQ" }).click();
  await expect(page.getByRole("region", { name: "Changes to publish" })).toContainText("Remove FAQ");
  // Nothing changes until it's published.
  expect(onDisk("blocks/installed/shadcn-faq/block.tsx")).toBe(true);
  await publishBlocks(page);
  await expect.poll(() => onDisk("blocks/installed/shadcn-faq/block.tsx")).toBe(false);
  expect(onDisk("components/ui/accordion.tsx")).toBe(false);
  expect(readFileSync(join(site as string, "blocks/installed/index.ts"), "utf8")).not.toContain("shadcn-faq");
});

// The built site's admin panel installs from the registry's release on jsDelivr; tests serve the built registry instead.
const registryDir = fileURLToPath(new URL("../node_modules/@goodfellow/registry/r/", import.meta.url));

baseTest("adds a block to a site on GitHub in one publish", async ({ page }) => {
  const fake = fakeGitHub({
    repo: "parish/site",
    files: files(),
    tokens: { "good-token": { login: "maria", name: "Maria" } },
    deployAfterChecks: 0,
  });
  await routeToFake(page, "https://api.github.com", fake.handle);
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/@goodfellow\/registry@[^/]+\/r\/([a-z0-9-]+\.json)$/, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: readFileSync(join(registryDir, new URL(route.request().url()).pathname.split("/").at(-1) ?? ""), "utf8"),
    }),
  );

  await page.goto(`${GITHUB_SITE}/admin/`);
  await page.getByLabel("Access token").fill("good-token");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: "Blocks", exact: true }).click();
  const before = fake.repo.head();
  await page.getByRole("button", { name: "Add Tabs" }).click();
  await page.getByRole("button", { name: "Add FAQ" }).click();
  await baseExpect(page.getByRole("region", { name: "Changes to publish" })).toContainText("Add Tabs");
  await publishBlocks(page);
  await baseExpect(page.getByText("Published. Added blocks will be in the editor")).toBeVisible();

  // Both in one save.
  const commit = fake.repo.commitAt(fake.repo.head());
  baseExpect(commit?.message).toBe("Change blocks: add Tabs, FAQ");
  baseExpect(commit?.parent).toBe(before);
  const repoFiles = fake.repo.files();
  for (const path of [
    "blocks/installed/shadcn-tabs/block.tsx",
    "blocks/installed/shadcn-tabs/tabs-view.tsx",
    "components/ui/tabs.tsx",
    "blocks/installed/shadcn-faq/block.tsx",
    "components/ui/accordion.tsx",
    "blocks/installed/installed.json",
    "blocks/installed/index.ts",
  ]) {
    baseExpect(repoFiles.has(path), path).toBe(true);
  }
  await baseExpect(page.locator(".gfa-block-list")).toContainText("Tabs");
  await baseExpect(page.locator(".gfa-block-list")).toContainText("FAQ");
});

baseTest("adds a block to a Next.js site, which then runs it", async ({ page }) => {
  // `next dev` recompiles once after adding the block and again after the test resets it.
  baseTest.setTimeout(400_000);
  const root = nextSite as string;
  resetNextContent();
  try {
    await page.goto("http://localhost:4403/admin/#/blocks");
    await page.getByRole("button", { name: "Add FAQ" }).click({ timeout: 60_000 });
    await publishBlocks(page);
    await expect.poll(() => existsSync(join(root, "blocks/installed/installed.json")), { timeout: 60_000 }).toBe(true);

    writeFileSync(join(root, "content/pages/help.json"), `${JSON.stringify(faqPage, null, 2)}\n`);
    // `next dev` recompiles once the block is on disk; a page asked for meanwhile may not have it yet.
    await expect(async () => {
      await page.goto("http://localhost:4403/help/");
      await baseExpect(page.getByRole("button", { name: "When are you open?" })).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 90_000 });
    const answer = page.getByText("Every day but Monday.");
    await expect(answer).toBeHidden();
    await expect(async () => {
      if (!(await answer.isVisible())) await page.getByRole("button", { name: "When are you open?" }).click();
      baseExpect(await answer.isVisible()).toBe(true);
    }).toPass({ timeout: 60_000 });
  } finally {
    // The site's pages and the admin panel both import the blocks, so both recompile.
    if (resetNextContent()) {
      await waitForCode(page, ["http://localhost:4403/about/", "http://localhost:4403/admin/"], 120_000);
    }
  }
});
