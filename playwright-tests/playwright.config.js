// @ts-check
const path = require("path");
const { defineConfig, devices } = require("@playwright/test");

const root = path.resolve(__dirname, "..");
const API_PORT = process.env.E2E_API_PORT || "5055";

/**
 * Runs the whole store locally against throwaway services:
 *   1. Firebase Auth emulator (no real accounts are created)
 *   2. stack.js: in-memory MongoDB seeded with the catalog + the API
 *   3. the Vite client, pointed at both
 * Run with: npm test  (from playwright-tests/)
 */
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "report" }]],

  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    // Lets CI or a cloud box point at a preinstalled Chromium; normally unset.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.js/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.js/ },
  ],

  webServer: [
    {
      command: "npx firebase emulators:start --only auth --project demo-wajd",
      cwd: __dirname,
      url: "http://127.0.0.1:9099",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "node stack.js",
      cwd: __dirname,
      url: `http://localhost:${API_PORT}/api/ping`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      cwd: path.join(root, "client"),
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        REACT_APP_API_URL: `http://localhost:${API_PORT}/api`,
        REACT_APP_AUTH_EMULATOR: "http://127.0.0.1:9099",
        REACT_APP_FIREBASE_PROJECT_ID: "demo-wajd",
        REACT_APP_FIREBASE_API_KEY: "demo-key",
        REACT_APP_FIREBASE_AUTH_DOMAIN: "demo-wajd.firebaseapp.com",
        REACT_APP_ADMIN_EMAIL: "admin@wajd.test",
      },
    },
  ],
});
