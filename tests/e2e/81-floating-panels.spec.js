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

  test("dragging one floating panel onto another nests them into a tab group, and a tab can split out", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } }));
      window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } }));
    });
    const cast = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-cast']").first();
    const items = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-items']").first();
    await expect(cast).toBeVisible({ timeout: 5000 });
    await expect(items).toBeVisible({ timeout: 5000 });
    await cast.locator("[data-testid='panel-float-toggle']").click();
    await items.locator("[data-testid='panel-float-toggle']").click();
    await expect(items).toHaveClass(/is-floating/, { timeout: 3000 });

    // Drag items' header onto cast → nest into one tab group
    const castBox = await cast.boundingBox();
    const ihb = await items.locator("[data-ui='PanelHeader']").boundingBox();
    await page.mouse.move(ihb.x + 40, ihb.y + 10);
    await page.mouse.down();
    await page.mouse.move(castBox.x + castBox.width / 2, castBox.y + 24, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(250);

    const tabs = page.locator("[data-ui='FloatGroupTabs']");
    await expect(tabs).toBeVisible({ timeout: 3000 });
    await expect(tabs.locator("[data-testid='float-tab-p-cast']")).toBeVisible();
    await expect(tabs.locator("[data-testid='float-tab-p-items']")).toBeVisible();
    // only the active member's body renders in the shared frame
    await expect(page.locator("[data-ui='SlidingPanel'][data-panel-id='p-items'].is-floating")).toBeVisible();

    // The split (⧉) control exists on each tab to pull it back out.
    await expect(tabs.locator("[data-testid='float-tab-p-items'] button[title*='Split']")).toHaveCount(1);
  });
});
