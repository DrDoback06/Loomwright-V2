// Workflow T86: purpose-built mobile Entity browse & lookup. The bespoke split
// panels (roster + dossier) stack into a single column on the phone so the
// dossier gets the full sheet width instead of the desktop 220px+detail grid
// that squeezed it to ~150px.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.describe("T86. Mobile entity browse", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/Loomwright%20Shell.html");
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    const wired = await page.evaluate(() => typeof window.MobileBottomNav !== "undefined");
    test.skip(!wired, "mobile shell not wired into the dev shell yet");
  });

  test("a split entity panel stacks to one column with a full-width dossier", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "locations", { name: "Pale Reach", data: { kind: "region", summary: "A salt-bitten coast." } });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "locations" } })));

    const panel = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-locations']").first();
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Split is a single column on mobile.
    const split = panel.locator(".loc-body__split").first();
    const dir = await split.evaluate((el) => getComputedStyle(el).flexDirection);
    expect(dir).toBe("column");

    // The dossier now spans (close to) the full sheet width, not ~150px.
    const detailW = await panel.locator(".loc-body__detail").first().evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(detailW).toBeGreaterThan(300);

    // The roster collapses to free the sheet for the dossier (shared LocTreePane).
    const aside = panel.locator(".loc-body__tree").first();
    await panel.locator("[data-testid='loc-tree-toggle']").first().click();
    await expect(aside).toHaveClass(/is-collapsed/, { timeout: 2000 });
  });
});
