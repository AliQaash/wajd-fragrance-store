// @ts-check
const path = require("path");
const { defineConfig, devices } = require("@playwright/test");

// The Wajd project root (one level up from this playwright-tests/ folder).
const projectRoot = path.resolve(__dirname, "..");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,

  // list -> readable pass/fail lines in your terminal
  // html  -> a visual report (screenshots, traces) at playwright-tests/report/index.html
  reporter: [["list"], ["html", { open: "never", outputFolder: "report" }]],

  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // This is what satisfies "start both servers, or confirm they're already
  // running": Playwright checks each port first. If something is already
  // listening there (e.g. you already ran `npm run dev` yourself), it
  // reuses it and does nothing. If not, it runs the command for you and
  // waits until the port responds before starting the tests.
  webServer: [
    {
      command: "npm run server",
      cwd: projectRoot,
      port: 5000,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run client",
      cwd: projectRoot,
      port: 3000,
      reuseExistingServer: true,
      timeout: 120_000, // CRA's dev server can take a while to compile on first start
    },
  ],
});
