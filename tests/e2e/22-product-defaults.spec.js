// Workflow V — product defaults.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.describe("V. Product defaults", () => {
  test("a fresh project opens the Writer's Room with no automatic side panels", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } })));
    await expect(page.locator("[data-ui='ManuscriptCanvas']").first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(350);
    await expect(page.locator("[data-ui='SlidingPanel']")).toHaveCount(0);
  });

  test("panels still open normally after the clear first-paint default", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } })));
    const castPanel = page.locator("[data-panel-id='p-cast']");
    await expect(castPanel).toBeVisible({ timeout: 8000 });
    await expect(page.locator("[data-ui='SlidingPanel']")).toHaveCount(1);
  });
});
