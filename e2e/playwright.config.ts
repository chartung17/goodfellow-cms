import { defineConfig, devices } from "@playwright/test";

const PORT = 4400;

export default defineConfig({
  testDir: "tests",
  // Every test edits the same site on disk, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    // Lets environments with a preinstalled browser use it instead of `playwright install`.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: {
    command: `node scripts/start-site.mjs ${PORT}`,
    url: `http://localhost:${PORT}/admin`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
