// Workflow T77: Atlas full map editor — Phase 1 (foundation).
// Locations can now carry a drawable region shape (data.shape: rect/circle/
// polygon/freehand) that renders as a filled, labelled area on the map; and
// locations created in the entity editor auto-appear in the editor's
// "Unplaced" tray to be selected and drawn.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openAtlasEditor(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "atlas" } })));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-existing-fullscreen", { detail: { workspaceId: "atlas-editor" } })));
}

test.describe("T77. Atlas editor — shapes + unplaced tray", () => {
  test("drawn shapes render on the map; new locations land in the unplaced tray", async ({ page }) => {
    await openFreshApp(page);
    const region = await saveEntity(page, "locations", {
      name: "The Pale Reach",
      data: { kind: "region", shape: { type: "rect", x: 18, y: 22, w: 34, h: 28 } },
    }, { status: "active" });
    const unplaced = await saveEntity(page, "locations", { name: "Hidden Vale", data: { kind: "hidden" } }, { status: "active" });

    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // the drawn region renders as a real shape (a <rect>), not just a point pin
    const shape = editor.locator(`[data-atm-shape='${region.id}']`);
    await expect(shape).toBeVisible({ timeout: 5000 });
    await expect(shape.locator("rect")).toHaveCount(1);
    // and the region is NOT rendered as a point pin (shape replaces the pin)
    await expect(editor.locator(`[data-atm-pin='${region.id}']`)).toHaveCount(0);

    // the unplaced, editor-created location auto-appears in the tray
    const tray = page.locator(`[data-atlas-unplaced='${unplaced.id}']`);
    await expect(tray).toBeVisible({ timeout: 5000 });
    await expect(tray).toContainText("Hidden Vale");

    // the shaped region is NOT also listed as unplaced (it's placed via its shape)
    await expect(page.locator(`[data-atlas-unplaced='${region.id}']`)).toHaveCount(0);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/atlas-editor.png" });
  });

  test("drawing a rectangle assigns a persisted shape to the selected place", async ({ page }) => {
    await openFreshApp(page);
    const loc = await saveEntity(page, "locations", { name: "Glass Court", data: { kind: "city" } }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // pick the unplaced place from the tray, then choose the Rect tool
    await page.locator(`[data-atlas-unplaced='${loc.id}']`).click();
    await page.locator("[data-testid='ae-tool-draw-rect']").click();

    // drag a rectangle on the editor canvas
    const svg = editor.locator(".atm__svg");
    const box = await svg.boundingBox();
    const x1 = box.x + box.width * 0.30, y1 = box.y + box.height * 0.30;
    const x2 = box.x + box.width * 0.62, y2 = box.y + box.height * 0.60;
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2);
    await page.mouse.move(x2, y2);
    await page.mouse.up();
    await page.waitForTimeout(400);

    // the drawn rectangle is persisted onto that location
    const shape = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "locations")?.data?.shape, loc.id);
    expect(shape && shape.type).toBe("rect");
    expect(shape.w).toBeGreaterThan(1);
    expect(shape.h).toBeGreaterThan(1);
    // and it now renders as a region (no longer in the unplaced tray)
    await expect(editor.locator(`[data-atm-shape='${loc.id}'] rect`)).toHaveCount(1);
    await expect(page.locator(`[data-atlas-unplaced='${loc.id}']`)).toHaveCount(0);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/atlas-draw.png" });
  });
});
