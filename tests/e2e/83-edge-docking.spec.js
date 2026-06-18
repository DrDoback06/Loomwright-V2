// Workflow T83: split-pane edge-docking (opt-in). A floating panel dragged to
// a workspace edge docks into a resizable region on that edge, and the route
// content reflows around it (a real split, not an overlay). Docked panels
// resize via a splitter and pop back out to a floating window.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function floatPanel(page, kind) {
  await page.evaluate((k) => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } })), kind);
  const panel = page.locator(`[data-ui='SlidingPanel'][data-panel-id='p-${kind}']`).first();
  await expect(panel).toBeVisible({ timeout: 5000 });
  await panel.locator("[data-testid='panel-float-toggle']").click();
  await expect(panel).toHaveClass(/is-floating/, { timeout: 3000 });
  return panel;
}

async function dragHeaderTo(page, panel, x, y) {
  const hb = await panel.locator("[data-ui='PanelHeader']").boundingBox();
  await page.mouse.move(hb.x + 40, hb.y + 10);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test.describe("T83. Split-pane edge-docking", () => {
  test("dragging a floating panel to the right edge docks it and reflows content", async ({ page }) => {
    await openFreshApp(page);
    const panel = await floatPanel(page, "cast");
    const wb = await page.locator(".app-work").boundingBox();

    await dragHeaderTo(page, panel, wb.x + wb.width - 8, wb.y + wb.height / 2);

    await expect(panel).toHaveClass(/is-edge-docked/, { timeout: 3000 });
    await expect(panel).not.toHaveClass(/is-floating/);
    const region = page.locator("[data-ui='EdgeDock'][data-edge='right']");
    await expect(region).toBeVisible();

    // Route content reflows: its right inset is the dock width (non-zero).
    const rightInset = await page.locator(".app-work__content").evaluate((el) => parseInt(getComputedStyle(el).right, 10) || 0);
    expect(rightInset).toBeGreaterThan(100);
  });

  test("a docked region resizes via its splitter", async ({ page }) => {
    await openFreshApp(page);
    const panel = await floatPanel(page, "items");
    const wb = await page.locator(".app-work").boundingBox();
    await dragHeaderTo(page, panel, wb.x + wb.width - 8, wb.y + wb.height / 2);

    const region = page.locator("[data-ui='EdgeDock'][data-edge='right']");
    await expect(region).toBeVisible({ timeout: 3000 });
    const before = await region.boundingBox();

    // Drag the inner splitter further left → region widens.
    const handle = region.locator("[data-testid='dock-resize-right']");
    const hb = await handle.boundingBox();
    await page.mouse.move(hb.x + 3, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 3 - 120, hb.y + hb.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    const after = await region.boundingBox();
    expect(Math.round(after.width - before.width)).toBeGreaterThan(60);
  });

  test("a docked panel pops back out to a floating window", async ({ page }) => {
    await openFreshApp(page);
    const panel = await floatPanel(page, "cast");
    const wb = await page.locator(".app-work").boundingBox();
    await dragHeaderTo(page, panel, wb.x + 8, wb.y + wb.height / 2);   // left edge
    await expect(panel).toHaveClass(/is-edge-docked/, { timeout: 3000 });
    await expect(page.locator("[data-ui='EdgeDock'][data-edge='left']")).toBeVisible();

    // Pop-out toggle undocks → floating window again.
    await panel.locator("[data-testid='panel-float-toggle']").click();
    await expect(panel).toHaveClass(/is-floating/, { timeout: 3000 });
    await expect(panel).not.toHaveClass(/is-edge-docked/);
  });

  test("dropping a menu tab near an edge docks it there", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(() => {
      const work = document.querySelector(".app-work");
      const r = work.getBoundingClientRect();
      const ev = new Event("drop", { bubbles: true, cancelable: true });
      ev.clientX = r.left + 10; ev.clientY = r.top + r.height / 2;   // near left edge
      ev.dataTransfer = { getData: (t) => (t === "text/loomwright-nav-kind" ? "bestiary" : ""), types: ["text/loomwright-nav-kind"] };
      work.dispatchEvent(ev);
    });
    const panel = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-bestiary']").first();
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel).toHaveClass(/is-edge-docked/, { timeout: 3000 });
    await expect(page.locator("[data-ui='EdgeDock'][data-edge='left']")).toBeVisible();
  });
});
