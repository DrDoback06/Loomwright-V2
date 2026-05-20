// =====================================================================
// playwright.preview.config.js
//
// Runs the production-build boot smoke suite against `vite preview`
// serving the precompiled dist/ output (port 5180). Use:
//   npm run build && npm run test:e2e:preview
//
// This proves the PRODUCTION path boots (no in-browser Babel, no CDN
// runtime). The full dev-shell suite stays in playwright.config.js.
// =====================================================================

const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e-preview",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5180",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "chromium-preview",
      use: {
        ...devices["Desktop Chrome"],
        ignoreHTTPSErrors: true,
        ...(process.env.CHROMIUM_PATH
          ? {
              launchOptions: {
                executablePath: process.env.CHROMIUM_PATH,
                args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--ignore-certificate-errors"],
              },
            }
          : {}),
      },
    },
  ],
  webServer: {
    command: "npx vite preview --outDir dist --host 0.0.0.0 --port 5180",
    port: 5180,
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
  },
});
