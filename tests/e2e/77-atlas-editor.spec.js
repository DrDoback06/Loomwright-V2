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
});
