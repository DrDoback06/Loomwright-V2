// Workflow T70: Random Tables tab — regression. Audit expectation: rolling
// works (RandomTableService.rollAndLog) and custom-table create/edit + roll
// history persist to KEYS.randomTables (built-ins are bundled seed content).
// This verifies a built-in table rolls, the roll logs to history, and
// creating a custom table persists.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openRandomTablesPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "randomTables" } })));
  await page.waitForTimeout(300);
}

test.describe("T70. Random Tables tab", () => {
  test("rolls a built-in table + creating a custom table persists", async ({ page }) => {
    await openFreshApp(page);
    await openRandomTablesPanel(page);
    const panel = page.locator("[data-ui='RandomTablesPanelBody']");
    await expect(panel).toBeVisible({ timeout: 5000 });

    const rows = page.locator(".rt__row");
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
    const builtinCount = await page.evaluate(() => window.LoomwrightBackend.RandomTableService.listSync().length);
    expect(builtinCount).toBeGreaterThan(0); // bundled starter tables

    // select + roll -> a result shows and logs to history (persists)
    await rows.first().click();
    await page.locator("[data-testid='rt-roll']").click();
    await expect(page.locator("[data-ui='RtResults']")).toBeVisible({ timeout: 5000 });
    const histLen = await page.evaluate(() => window.LoomwrightBackend.RandomTableService.historySync().length);
    expect(histLen).toBeGreaterThan(0);

    // create a custom table -> persists to the store
    await page.locator("[data-testid='rt-new-table']").click();
    await page.waitForTimeout(250);
    const afterCount = await page.evaluate(() => window.LoomwrightBackend.RandomTableService.listSync().length);
    expect(afterCount).toBe(builtinCount + 1);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/randomtables.png" });
  });
});
