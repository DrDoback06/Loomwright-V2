// Workflow T81: detachable / floating panels (opt-in). A docked panel can
// pop out into a fixed, movable/resizable window over the workspace, and dock
// back. The stacked layout remains the default.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.describe("T81. Floating / detachable panels", () => {
  test("a panel pops out into a floating window and docks back", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } })));
    const panel = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-cast']").first();
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Pop out → floating, fixed-positioned window
    await panel.locator("[data-testid='panel-float-toggle']").click();
    await expect(panel).toHaveClass(/is-floating/, { timeout: 3000 });
    expect(await panel.evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
    await expect(panel.locator("[data-testid='panel-float-resize']")).toBeVisible();

    // Dock back → returns to the stack
    await panel.locator("[data-testid='panel-float-toggle']").click();
    await expect(panel).not.toHaveClass(/is-floating/, { timeout: 3000 });
  });

  test("a floating panel moves when its header is dragged", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } })));
    const panel = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-items']").first();
    await expect(panel).toBeVisible({ timeout: 5000 });
    await panel.locator("[data-testid='panel-float-toggle']").click();
    await expect(panel).toHaveClass(/is-floating/, { timeout: 3000 });

    const before = await panel.boundingBox();
    const head = panel.locator("[data-ui='PanelHeader']");
    const hb = await head.boundingBox();
    await page.mouse.move(hb.x + 40, hb.y + 10);
    await page.mouse.down();
    await page.mouse.move(hb.x + 40 + 120, hb.y + 10 + 80, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const after = await panel.boundingBox();
    expect(Math.round(after.x - before.x)).toBeGreaterThan(60);   // moved right
    expect(Math.round(after.y - before.y)).toBeGreaterThan(40);   // moved down
  });

  test("dragging a tab out of the menu opens it as a floating window", async ({ page }) => {
    await openFreshApp(page);
    // the rail tabs are draggable (routes are not)
    await expect(page.locator("[data-testid='leftrail-cast']")).toHaveAttribute("draggable", "true");
    // simulate the drop onto the workspace with the nav payload
    await page.evaluate(() => {
      const work = document.querySelector(".app-work");
      const ev = new Event("drop", { bubbles: true, cancelable: true });
      ev.clientX = 520; ev.clientY = 300;
      ev.dataTransfer = { getData: (t) => (t === "text/loomwright-nav-kind" ? "cast" : ""), types: ["text/loomwright-nav-kind"] };
      work.dispatchEvent(ev);
    });
    const panel = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-cast']").first();
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel).toHaveClass(/is-floating/);
  });
});
