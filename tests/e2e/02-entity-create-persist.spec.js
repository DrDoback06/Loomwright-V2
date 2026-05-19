// Workflow C: create entities and confirm they persist across reload.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity, getEntityCount } = require("./helpers");

test.describe("C. Entity create + persist", () => {
  for (const [type, name] of [
    ["cast", "Test Character"],
    ["locations", "Test Location"],
    ["items", "Test Item"],
    ["quests", "Test Quest"],
    ["events", "Test Event"],
  ]) {
    test(`creates a ${type} and persists across reload`, async ({ page }) => {
      await openFreshApp(page);
      await saveEntity(page, type, { name }, { status: "active" });
      expect(await getEntityCount(page, type)).toBeGreaterThanOrEqual(1);
      await openAppPreserveState(page);
      expect(await getEntityCount(page, type)).toBeGreaterThanOrEqual(1);
      const live = await page.evaluate((t) => window.LoomwrightBackend.EntityService.listSync(t), type);
      expect(live.some((e) => e.name === name)).toBe(true);
    });
  }

  test("LinkService.linkField persists associations", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Aelinor" }, { status: "active" });
    const item = await saveEntity(page, "items", { name: "Auger of Hess" }, { status: "active" });
    await page.evaluate(async ({ castId, itemId }) => {
      await window.LoomwrightBackend.LinkService.linkField(castId, "cast", "items", itemId, "items");
    }, { castId: cast.id, itemId: item.id });
    const updated = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "cast"), cast.id);
    expect(updated.data.items).toContain(item.id);
  });
});
