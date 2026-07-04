// Workflow U24: Area 4 phase 4 — Atlas renders and edits live data.
//
// The designed Atlas (side panel, parchment map, full-screen editor,
// scrubber, queue) is driven by AtlasService.buildAtlasDataSync():
// placed location entities become pins/regions, data.routes become road
// lines, occurrences derive character travel routes, and the editor's
// Add Location / Add Route tools persist through AtlasService.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openAtlasPanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "atlas" } }));
  });
  await page.waitForTimeout(350);
}

async function seedWorld(page) {
  return await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    const gate = await B.EntityService.save("locations", {
      name: "Toll Gate", summary: "A fortified toll crossing.",
      data: { placed: true, coords: { x: 30, y: 40 }, kind: "city" },
    }, { status: "active" });
    const mill = await B.EntityService.save("locations", {
      name: "Mill Bridge", data: { placed: true, coords: { x: 60, y: 50 }, kind: "town" },
    }, { status: "active" });
    const vale = await B.EntityService.save("locations", {
      name: "Hidden Vale", data: { placed: false, kind: "hidden" },
    }, { status: "active" });
    await B.AtlasService.setRoute(gate.id, mill.id, "road");
    return { gateId: gate.id, millId: mill.id, valeId: vale.id };
  });
}

test.describe("U24. Atlas — live map", () => {
  test("fresh project shows the designed empty plate (no demo world)", async ({ page }) => {
    await openFreshApp(page);
    await openAtlasPanel(page);
    const atlas = page.locator("[data-ui='AtlasPanelBody']");
    await expect(atlas).toBeVisible();
    await expect(atlas.locator("[data-ui='AtlasEmptyPlate']").first()).toBeVisible();
    await expect(atlas).not.toContainText("Pale Reach");
    await expect(atlas).not.toContainText("Glass Court");
  });

  test("placed locations pin to the plate; roads connect them; unplaced stay off-map", async ({ page }) => {
    await openFreshApp(page);
    await seedWorld(page);
    await openAtlasPanel(page);
    const atlas = page.locator("[data-ui='AtlasPanelBody']");
    // Pins with live names render on the side-panel map.
    await expect(atlas.locator("svg text", { hasText: "Toll Gate" }).first()).toBeVisible();
    await expect(atlas.locator("svg text", { hasText: "Mill Bridge" }).first()).toBeVisible();
    // The drawn road connection renders.
    await expect(atlas.locator(".atm-roads line").first()).toBeVisible();
    // Unplaced location stays off the plate.
    await expect(atlas.locator("svg text", { hasText: "Hidden Vale" })).toHaveCount(0);
    const data = await page.evaluate(() => {
      const d = window.LoomwrightBackend.AtlasService.buildAtlasDataSync();
      return {
        placed: d.locations.filter((l) => l.placed).length,
        unplaced: d.locations.filter((l) => !l.placed).length,
        roads: d.roads.length,
      };
    });
    expect(data.placed).toBe(2);
    expect(data.unplaced).toBe(1);
    expect(data.roads).toBe(1);
  });

  test("character travel routes derive from shared-chapter occurrences", async ({ page }) => {
    await openFreshApp(page);
    const ids = await seedWorld(page);
    await page.evaluate(async ({ gateId, millId }) => {
      const B = window.LoomwrightBackend;
      const anwen = await B.EntityService.save("cast", { name: "Anwen Hale", data: { role: "protagonist" } }, { status: "active" });
      await B.ManuscriptChapterService.save({
        chapters: [
          { id: "u24-c1", num: 1, title: "The Gate" },
          { id: "u24-c2", num: 2, title: "The Bridge" },
        ],
        activeChapterId: "u24-c1",
        manuscripts: {},
      });
      const occ = (entityId, chapterId, text) => B.OccurrenceService.save({
        entityId, chapterId, startOffset: 0, endOffset: text.length, exactText: text, entityType: "any",
      });
      await occ(anwen.id, "u24-c1", "Anwen reached the toll gate at dusk.");
      await occ(gateId, "u24-c1", "the toll gate");
      await occ(anwen.id, "u24-c2", "Anwen crossed at the mill.");
      await occ(millId, "u24-c2", "Mill Bridge");
    }, ids);
    const route = await page.evaluate(() => {
      const d = window.LoomwrightBackend.AtlasService.buildAtlasDataSync();
      return d.routes[0] || null;
    });
    expect(route).not.toBeNull();
    expect(route.characterName).toBe("Anwen Hale");
    expect(route.waypoints.length).toBe(2);
    expect(route.waypoints[0].kind).toBe("depart");
    expect(route.waypoints[1].kind).toBe("arrive");
  });

  test("editor Add Location tool creates a placed entity at the tapped point", async ({ page }) => {
    await openFreshApp(page);
    await seedWorld(page);
    await openAtlasPanel(page);
    // Open the full-screen editor.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-existing-fullscreen", { detail: { panelKind: "atlas" } }));
    });
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });
    // Arm the Add Location tool, then tap the parchment.
    await editor.locator("[data-tool='addLoc']").click();
    const canvas = editor.locator(".atlas-editor__canvas svg.atm__svg");
    await canvas.click({ position: { x: 320, y: 180 } });
    await page.waitForTimeout(400);
    const created = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("locations")
        .filter((l) => l.status !== "deleted" && l.name === "New location")
        .map((l) => l.data || {})[0] || null);
    expect(created).not.toBeNull();
    expect(created.placed).toBe(true);
    expect(typeof created.coords.x).toBe("number");
    // The entity editor opened for naming.
    await expect(page.locator("[data-ui='EntityEditor'], .ee-host, .entity-editor").first()).toBeVisible();
  });

  test("editor Add Route tool draws a persisted connection between two pins", async ({ page }) => {
    await openFreshApp(page);
    const ids = await seedWorld(page);
    // Remove the seeded road so the tool draws the first one.
    await page.evaluate(async ({ gateId, millId }) => {
      await window.LoomwrightBackend.AtlasService.removeRoute(gateId, millId);
    }, ids);
    await openAtlasPanel(page);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-existing-fullscreen", { detail: { panelKind: "atlas" } }));
    });
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.locator("[data-tool='addRoute']").click();
    // Tap origin pin, then destination pin (placed at 30/40 and 60/50 pct).
    const canvas = editor.locator(".atlas-editor__canvas svg.atm__svg");
    await canvas.locator("[data-atm-pin]").filter({ hasText: "Toll Gate" }).first().click();
    await canvas.locator("[data-atm-pin]").filter({ hasText: "Mill Bridge" }).first().click();
    await page.waitForTimeout(400);
    const roads = await page.evaluate(() => window.LoomwrightBackend.AtlasService.buildAtlasDataSync().roads.length);
    expect(roads).toBe(1);
    await expect(editor.locator(".atm-roads line").first()).toBeVisible();
  });
});

test.describe("U24b. Atlas — layer opacity", () => {
  test("persisted layer opacity applies to the map's pin groups", async ({ page }) => {
    await openFreshApp(page);
    await seedWorld(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const section = B.SettingsService.getSectionSync("atlas", {}) || {};
      await B.SettingsService.saveSection("atlas", { ...section, layerOpacity: { settlements: 30 } });
    });
    await openAtlasPanel(page);
    const pin = page.locator("[data-atm-pin]").first();
    await expect(pin).toBeVisible();
    const op = await pin.getAttribute("opacity");
    expect(Number(op)).toBeCloseTo(0.3, 5);
  });
});
