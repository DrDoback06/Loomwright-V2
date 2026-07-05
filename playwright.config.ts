import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  // The suite is >100 real-click specs across two workers on small
  // runners; prose-typing specs legitimately take a while under load.
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}/Loomwright-V2/`,
    trace: 'retain-on-failure',
    // Sandboxed/dev environments provide a system Chromium (e.g.
    // /opt/pw-browsers/chromium) instead of Playwright's downloads.
    // CI leaves this unset and uses `npx playwright install chromium`.
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/Loomwright-V2/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
