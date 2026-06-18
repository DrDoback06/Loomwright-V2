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

    // The roster collapses to free the sheet (shared LocTreePane / hierarchy toggle).
    const aside = panel.locator(".loc-body__tree").first();
    await panel.locator("[data-testid='loc-tree-toggle']").first().click();
    await expect(aside).toHaveClass(/is-collapsed/, { timeout: 2000 });

    // Entering the dossier (tap a row), it spans (close to) the full sheet
    // width, not the desktop ~150px detail column.
    await panel.locator("[data-testid='loc-tree-toggle']").first().click(); // re-expand list
    await panel.locator(".loc-tree__row").first().click();
    const detailW = await panel.locator(".loc-body__detail").first().evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(detailW).toBeGreaterThan(300);
  });

  test("master-detail: tapping a row shows the dossier with a back button", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "locations", { name: "Pale Reach", data: { kind: "region" } });
    await saveEntity(page, "locations", { name: "Hess", data: { kind: "city" } });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "locations" } })));

    const panel = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-locations']").first();
    await expect(panel).toBeVisible({ timeout: 5000 });
    const split = panel.locator(".loc-body__split").first();

    // Default: list view — roster shown, dossier hidden, no back button.
    await expect(split).toHaveAttribute("data-md", "list");
    await expect(panel.locator(".loc-body__tree").first()).toBeVisible();
    await expect(panel.locator("[data-testid='loc-md-back']")).toBeHidden();

    // Tap a row → dossier view with a back button; roster hidden.
    await panel.locator(".loc-tree__row").first().click();
    await expect(split).toHaveAttribute("data-md", "detail", { timeout: 2000 });
    await expect(panel.locator(".loc-body__detail").first()).toBeVisible();
    await expect(panel.locator("[data-testid='loc-md-back']")).toBeVisible();
    await expect(panel.locator(".loc-body__tree").first()).toBeHidden();

    // Back → list.
    await panel.locator("[data-testid='loc-md-back']").click();
    await expect(split).toHaveAttribute("data-md", "list", { timeout: 2000 });
    await expect(panel.locator(".loc-body__tree").first()).toBeVisible();
  });
});
