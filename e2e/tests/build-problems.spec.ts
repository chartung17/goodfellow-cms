import { fakeGitHub } from "@goodfellow-cms/github/testing";
import { fakeGitLab } from "@goodfellow-cms/gitlab/testing";
import { expect, type Page, test } from "@playwright/test";
import { files, GITHUB_SITE, GITLAB_SITE, routeToFake } from "./backends.js";

/** Publishes a change to the site's name, and returns once it's been published. */
async function publishSiteName(page: Page, head: () => string) {
  const before = head();
  await page.getByLabel("Site name").fill("St. Joseph Parish");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect.poll(head).not.toBe(before);
  return head();
}

test("explains a GitHub rebuild that failed installing packages", async ({ page }) => {
  test.slow();
  const fake = fakeGitHub({ repo: "parish/site", files: files() });
  await routeToFake(page, "https://api.github.com", fake.handle);

  await page.goto(`${GITHUB_SITE}/admin/#/settings/general`);
  await page.getByLabel("Access token").fill("test-token");
  await page.getByRole("button", { name: "Sign in" }).click();
  const revision = await publishSiteName(page, () => fake.repo.head());
  // A build that fails never deploys, so only the workflow run says it failed.
  fake.failBuild(revision, "Run npm ci");

  await expect(page.getByText("The live site couldn't be updated")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "What went wrong?" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("The site's packages couldn't be installed");
  await expect(dialog.getByRole("link", { name: "See the details on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/parish/site/actions/runs/1",
  );
});

test("explains a GitLab rebuild that failed on a content file, and links to its version history", async ({ page }) => {
  test.slow();
  const fake = fakeGitLab({ project: "parish/site", files: files(), tokens: { "glpat-test": { username: "maria" } } });
  await routeToFake(page, "https://gitlab.com/api", fake.handle);

  await page.goto(`${GITLAB_SITE}/admin/#/settings/general`);
  await page.getByText("Or sign in with an access token").click();
  await page.getByLabel("Access token").fill("glpat-test");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const revision = await publishSiteName(page, () => fake.repo.head());
  fake.failBuild(revision, {
    trace: [
      "$ npm ci --cache .npm --prefer-offline",
      "$ npx goodfellow build",
      'goodfellow-build-problem {"kind":"content","file":"content/pages/about.json","message":"content/pages/about.json: isn\'t valid JSON."}',
      "ERROR: Job failed: exit code 1",
    ].join("\n"),
  });

  await expect(page.getByText("The live site couldn't be updated")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "What went wrong?" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("because content/pages/about.json has a problem");
  await dialog.getByText("Details", { exact: true }).click();
  await expect(dialog).toContainText("isn't valid JSON.");
  await dialog.getByRole("link", { name: "Version history of content/pages/about.json" }).click();
  await expect(page.getByRole("heading", { name: /^Version history: / })).toBeVisible();
});
