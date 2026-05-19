// =====================================================================
// playwright.config.js
//
// E2E browser tests for Loomwright v2. Run with:
//   npm run test:e2e
//
// Setup (first time):
//   npm install
//   npx playwright install chromium
//
// The dev server is started automatically by the `webServer` config below.
// =====================================================================

const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // share dev server; tests touch shared IDB origin
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5179",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Honour a host-provided Chrome (e.g. Chrome-for-Testing) when the
        // Playwright CDN is unreachable. Set CHROMIUM_PATH to the chrome
        // executable. Args include --no-sandbox for rootless/CI sandboxes.
        // Loomwright Shell.html loads React/Babel-standalone from
        // unpkg.com. In a fresh sandbox without a complete CA bundle the
        // TLS chain fails (ERR_CERT_AUTHORITY_INVALID), so we accept
        // certificate errors here. Has no effect when run on a normal
        // dev machine where the cert chain is already trusted.
        ignoreHTTPSErrors: true,
        ...(process.env.CHROMIUM_PATH
          ? {
              launchOptions: {
                executablePath: process.env.CHROMIUM_PATH,
                args: [
                  "--no-sandbox",
                  "--disable-dev-shm-usage",
                  "--disable-gpu",
                  "--ignore-certificate-errors",
                ],
              },
            }
          : {}),
      },
    },
  ],
  webServer: {
    command: "npx vite --host 0.0.0.0 --port 5179",
    port: 5179,
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
  },
});
