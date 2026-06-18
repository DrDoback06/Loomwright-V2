// Workflow T84: purpose-built mobile Writing surface. On the phone the
// manuscript formatting toolbar collapses to ONE horizontally-scrollable touch
// strip (no multi-row wrap) and the redundant breadcrumb is dropped, so the
// manuscript itself gets the scarce vertical room.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.describe("T84. Mobile writing surface", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/Loomwright%20Shell.html");
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    const wired = await page.evaluate(() => typeof window.MobileBottomNav !== "undefined");
    test.skip(!wired, "mobile shell not wired into the dev shell yet");
  });

  test("toolbar is a single scrollable row and the breadcrumb is dropped", async ({ page }) => {
    await openFreshApp(page);
    await page.locator("[data-testid='mnav-write']").tap();

    const wr = page.locator("[data-ui='WritersRoomScreen']");
    await expect(wr).toBeVisible({ timeout: 5000 });
    await expect(wr).toHaveAttribute("data-mobile", "true");

    // Toolbar present and laid out as a single (non-wrapping) row.
    const toolbar = page.locator("[data-ui='ManuscriptToolbar']");
    await expect(toolbar).toBeVisible();
    const flexWrap = await toolbar.evaluate((el) => getComputedStyle(el).flexWrap);
    expect(flexWrap).toBe("nowrap");
    const overflowX = await toolbar.evaluate((el) => getComputedStyle(el).overflowX);
    expect(overflowX).toBe("auto");
    // A single row stays short (a wrapped 3-4 row toolbar would be ~120px+).
    const h = await toolbar.evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBeLessThan(64);

    // The breadcrumb (Project / Book / Chapter) is hidden on mobile.
    await expect(page.locator(".wr-canvasbar__crumb")).toBeHidden();

    // Touch targets are enlarged.
    const btnW = await page.locator(".wr-toolbar__btn").first().evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(btnW).toBeGreaterThanOrEqual(32);
  });
});
