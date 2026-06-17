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

  test("moving a selected region persists the new position", async ({ page }) => {
    await openFreshApp(page);
    const loc = await saveEntity(page, "locations", {
      name: "Vault", data: { kind: "building", shape: { type: "rect", x: 30, y: 35, w: 18, h: 18 } },
    }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    const rect = editor.locator(`[data-atm-shape='${loc.id}'] rect`);
    await expect(rect).toHaveCount(1);
    await rect.click();                 // select the region (handles appear)
    await page.waitForTimeout(150);

    // drag the body down-right to move it
    const box = await rect.boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 45);
    await page.mouse.move(cx + 95, cy + 65);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const shape = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "locations")?.data?.shape, loc.id);
    expect(shape.type).toBe("rect");
    expect(shape.x).toBeGreaterThan(31); // moved right
    expect(shape.y).toBeGreaterThan(36); // moved down
    expect(Math.round(shape.w)).toBe(18); // size preserved by a move
  });

  test("wheel zoom transforms the canvas; style toggle flips", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "locations", { name: "Anyplace", data: { kind: "city", shape: { type: "rect", x: 40, y: 40, w: 12, h: 12 } } }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    const contentG = editor.locator(".atm__svg > g").first();
    await expect(contentG).toHaveAttribute("transform", /scale\(1\)/);

    // wheel up over the canvas zooms in (real interaction, toolbar-independent)
    const svg = editor.locator(".atm__svg");
    const box = await svg.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -360);
    await page.waitForTimeout(150);
    const zoomed = await contentG.getAttribute("transform");
    expect(zoomed).not.toContain("scale(1)"); // zoomed past 1x

    // the parchment/clean style toggle flips state
    const styleBtn = editor.locator("[data-testid='ae-style-toggle']");
    const wasActive = await styleBtn.evaluate((el) => el.classList.contains("is-active"));
    await styleBtn.evaluate((el) => el.click());
    await page.waitForTimeout(100);
    const nowActive = await styleBtn.evaluate((el) => el.classList.contains("is-active"));
    expect(nowActive).toBe(!wasActive);
  });

  test("double-click drills into a place's interior; breadcrumb returns", async ({ page }) => {
    await openFreshApp(page);
    const court = await saveEntity(page, "locations", {
      name: "Glass Court", data: { kind: "building", shape: { type: "rect", x: 28, y: 28, w: 30, h: 30 } },
    }, { status: "active" });
    const hall = await saveEntity(page, "locations", {
      name: "Throne Hall",
      data: { kind: "room", atlasMap: court.id, parentId: court.id, shape: { type: "rect", x: 34, y: 34, w: 22, h: 22 } },
    }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // World map: the building shows; its interior room does NOT; no floor grid
    await expect(editor.locator(`[data-atm-shape='${court.id}']`)).toBeVisible({ timeout: 5000 });
    await expect(editor.locator(`[data-atm-shape='${hall.id}']`)).toHaveCount(0);
    await expect(editor.locator('.atm__svg [fill="url(#atm-floor)"]')).toHaveCount(0);

    // drill into the building
    await editor.locator(`[data-atm-shape='${court.id}']`).dblclick();
    await expect(editor.locator(`[data-atlas-crumb='${court.id}']`)).toBeVisible({ timeout: 5000 });
    // now the room shows; the building (parent map) does not; floor-plan backdrop appears
    await expect(editor.locator(`[data-atm-shape='${hall.id}']`)).toBeVisible({ timeout: 5000 });
    await expect(editor.locator(`[data-atm-shape='${court.id}']`)).toHaveCount(0);
    await expect(editor.locator('.atm__svg [fill="url(#atm-floor)"]').first()).toBeVisible({ timeout: 3000 });

    // breadcrumb back to the world
    await editor.locator("[data-atlas-crumb='world']").click();
    await expect(editor.locator(`[data-atm-shape='${court.id}']`)).toBeVisible({ timeout: 5000 });
    await expect(editor.locator(`[data-atm-shape='${hall.id}']`)).toHaveCount(0);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/atlas-drill.png" });
  });

  test("the Path tool draws an open (unfilled) river/road stroke", async ({ page }) => {
    await openFreshApp(page);
    const loc = await saveEntity(page, "locations", { name: "Salt River", data: { kind: "river" } }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    await page.locator(`[data-atlas-unplaced='${loc.id}']`).click();   // select the place
    await editor.locator("[data-testid='ae-tool-draw-path']").click(); // Path tool

    const svg = editor.locator(".atm__svg");
    const box = await svg.boundingBox();
    const x0 = box.x + box.width * 0.25, y0 = box.y + box.height * 0.45;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x0 + 60, y0 - 25);
    await page.mouse.move(x0 + 120, y0 + 30);
    await page.mouse.move(x0 + 180, y0 - 12);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const shape = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "locations")?.data?.shape, loc.id);
    expect(shape.type).toBe("path");
    expect(shape.points.length).toBeGreaterThanOrEqual(2);
    // an open line — no fill
    await expect(editor.locator(`[data-atm-shape='${loc.id}'] path`).first()).toHaveAttribute("fill", "none");
  });
});
