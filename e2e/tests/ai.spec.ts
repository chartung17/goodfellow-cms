import { fakeAi } from "@goodfellow-cms/ai/testing";
import type { Page } from "@playwright/test";
import { routeToFake } from "./backends.js";
import { canvas, expect, openPageEditor, publishInEditor, readJson, readSiteFile, test } from "./helpers.js";

const KEY = "sk-ant-test-key";

/** The AI panel in the editor's left-hand rail. */
async function openAiPanel(page: Page) {
  await page.locator(".gfa-editor").getByText("AI", { exact: true }).first().click();
  const panel = page.locator(".gfa-ai");
  await expect(panel.getByRole("heading", { name: "Write with AI" })).toBeVisible();
  return panel;
}

/** Answers every Claude request with `answer`, recording what was sent. */
async function fakeClaude(page: Page, answer: (body: Record<string, unknown>) => unknown) {
  const fake = fakeAi({ answer, keys: [KEY] });
  await routeToFake(page, "https://api.anthropic.com", fake.handle);
  return fake;
}

test("adds blocks to a page with Claude, using the editor's own key", async ({ page }) => {
  const fake = await fakeClaude(page, () => ({
    blocks: [
      { type: "Section", id: "s", parent: null, slot: null, props: { padding: "md", background: "muted" } },
      { type: "Heading", id: "h", parent: "s", slot: "content", props: { text: "Christmas Masses", level: "h2" } },
      { type: "Text", id: "t", parent: "s", slot: "content", props: { content: "<p>Times: [Mass times]</p>" } },
    ],
  }));
  await openPageEditor(page, "/about", "About us");
  const panel = await openAiPanel(page);

  await panel.getByLabel("API key").fill(KEY);
  await panel.getByLabel("What should it write?").fill("A section about our Christmas Masses");
  await panel.getByRole("button", { name: "Write it" }).click();

  await expect(canvas(page).getByRole("heading", { name: "Christmas Masses" })).toBeVisible();
  await expect(canvas(page).getByText("Times: [Mass times]")).toBeVisible();
  await expect(panel.getByText(/^Done\./)).toBeVisible();

  const sent = fake.requests[0];
  expect(sent?.headers.get("x-api-key")).toBe(KEY);
  expect(sent?.body).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default" });
  expect(JSON.stringify(sent?.body.messages)).toContain("A section about our Christmas Masses");
  // Not asked to remember it, so the key is gone when the browser closes.
  expect(await page.evaluate(() => localStorage.getItem("goodfellow.ai.key.anthropic"))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("goodfellow.ai.key.anthropic"))).toBe(KEY);

  await publishInEditor(page);
  await expect(page.getByText("Published.", { exact: true })).toBeVisible();
  expect(readSiteFile("content/pages/about.json")).toContain("Christmas Masses");
});

test("changes the selected block", async ({ page }) => {
  const fake = await fakeClaude(page, () => ({
    blocks: [{ type: "Heading", id: "b1", parent: null, slot: null, props: { text: "Sobre nosotros", level: "h1" } }],
  }));
  await page.addInitScript((key) => localStorage.setItem("goodfellow.ai.key.anthropic", key), KEY);
  await openPageEditor(page, "/about", "About us");
  await canvas(page).locator('[data-puck-component="Heading-about"]').click();
  const panel = await openAiPanel(page);
  await expect(panel.getByText("Describe how to change the selected Heading.")).toBeVisible();

  await panel.getByLabel("What should it write?").fill("Translate into Spanish");
  await panel.getByRole("button", { name: "Change it" }).click();

  await expect(canvas(page).getByRole("heading", { name: "Sobre nosotros" })).toBeVisible();
  await expect(canvas(page).getByRole("heading", { name: "About us" })).toHaveCount(0);
  expect(JSON.stringify(fake.requests[0]?.body.messages)).toContain('\\"text\\": \\"About us\\"');
});

test("fills in an item's fields with a free service that needs no key", async ({ page }) => {
  const fake = fakeAi({
    answer: () => ({
      values: {
        title: "Homily: On hope",
        date: "2026-10-04",
        summary: "Fr. Smith on hope.",
        image: "",
        text: "<p>Hope.</p>",
      },
    }),
  });
  await routeToFake(page, "https://oai.endpoints.kepler.ai.cloud.ovh.net", fake.handle);
  await page.goto("/admin#/collections/news/edit?slug=open-house");
  const panel = await openAiPanel(page);
  await expect(panel.getByText("Describe this news story, or paste your notes")).toBeVisible();

  await panel
    .getByLabel("AI service", { exact: true })
    .selectOption({ label: "OVHcloud AI Endpoints (free, no key needed)" });
  await expect(panel.getByLabel("Model")).toHaveValue("gpt-oss-120b");
  await panel.getByLabel("What should it write?").fill("Sunday's homily, about hope");
  await panel.getByRole("button", { name: "Fill it in" }).click();

  await expect(canvas(page).getByRole("heading", { name: "Homily: On hope" })).toBeVisible();
  await expect(canvas(page).getByText("October 4, 2026")).toBeVisible();
  const sent = fake.requests.find((request) => request.url.endsWith("/chat/completions"));
  expect(sent?.headers.get("authorization")).toBeNull();
  expect(sent?.body.model).toBe("gpt-oss-120b");

  await publishInEditor(page);
  await expect(page.getByText("Published.", { exact: true })).toBeVisible();
  expect(readJson("content/collections/news/open-house.json")).toEqual({
    version: 1,
    fields: { title: "Homily: On hope", date: "2026-10-04", summary: "Fr. Smith on hope.", text: "<p>Hope.</p>" },
  });
});

test("works with any chat app by copying the request and pasting the answer", async ({ page }) => {
  await openPageEditor(page, "/about", "About us");
  const panel = await openAiPanel(page);
  await panel
    .getByLabel("AI service", { exact: true })
    .selectOption({ label: "Copy and paste into a chat app (free)" });
  await panel.getByLabel("What should it write?").fill("A thank-you note to our volunteers");
  await panel.getByRole("button", { name: "Write it" }).click();

  const request = panel.getByLabel("Copy this request into Claude.ai, ChatGPT or another chat app:");
  await expect(request).toHaveValue(/A thank-you note to our volunteers[\s\S]*JSON Schema/);
  await panel
    .getByLabel("Then paste the chat app's whole answer here:")
    .fill(
      'Here it is:\n```json\n{"blocks":[{"type":"Heading","id":"b1","parent":null,"slot":null,"props":{"text":"Thank you, volunteers"}}]}\n```',
    );
  await panel.getByRole("button", { name: "Use this answer" }).click();
  await expect(canvas(page).getByRole("heading", { name: "Thank you, volunteers" })).toBeVisible();
});

test("remembers the key only when asked, and forgets it", async ({ page }) => {
  await openPageEditor(page, "/about", "About us");
  const panel = await openAiPanel(page);
  await panel.getByLabel("API key").fill(KEY);
  await panel.getByLabel("Remember the key on this device").check();
  expect(await page.evaluate(() => localStorage.getItem("goodfellow.ai.key.anthropic"))).toBe(KEY);
  expect(await page.evaluate(() => sessionStorage.getItem("goodfellow.ai.key.anthropic"))).toBeNull();

  await panel.getByRole("button", { name: "Forget the key" }).click();
  await expect(panel.getByLabel("API key")).toHaveValue("");
  expect(await page.evaluate(() => localStorage.getItem("goodfellow.ai.key.anthropic"))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("goodfellow.ai.key.anthropic"))).toBeNull();
});

test("explains a key that doesn't work", async ({ page }) => {
  await fakeClaude(page, () => ({ blocks: [] }));
  await openPageEditor(page, "/about", "About us");
  const panel = await openAiPanel(page);
  await panel.getByLabel("API key").fill("sk-ant-wrong-key-123456");
  await panel.getByLabel("What should it write?").fill("Anything");
  await panel.getByRole("button", { name: "Write it" }).click();
  await expect(panel.getByText("Claude didn't accept the API key.", { exact: false })).toBeVisible();
  await expect(panel).not.toContainText("sk-ant-wrong-key-123456", { useInnerText: true });
});
