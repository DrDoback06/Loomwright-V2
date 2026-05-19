// Workflows H + I + J: sample project, trash, settings.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity } = require("./helpers");

test.describe("H. Sample project (opt-in)", () => {
  test("Load sample project populates entities and flag persists", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.SampleProjectService.loadSample();
    });
    const counts = await page.evaluate(() => {
      const all = window.LoomwrightBackend.EntityService.listAllSync();
      return Object.values(all).reduce((s, byId) => s + Object.keys(byId || {}).length, 0);
    });
    expect(counts).toBeGreaterThan(0);
    const flag = await page.evaluate(() => window.__LW_SAMPLE_LOADED__);
    expect(flag).toBe(true);
  });

  test("Clear sample preserves user-created entities", async ({ page }) => {
    await openFreshApp(page);
    const userEntity = await saveEntity(page, "cast", { name: "User-created", source: "manual" }, { status: "active" });
    await page.evaluate(async () => {
      await window.LoomwrightBackend.SampleProjectService.loadSample();
    });
    const beforeClear = await page.evaluate(() => window.LoomwrightBackend.EntityService.listAllSync());
    const sumBefore = Object.values(beforeClear).reduce((s, byId) => s + Object.keys(byId || {}).length, 0);
    expect(sumBefore).toBeGreaterThan(1);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.SampleProjectService.clearSample();
    });
    const userEntities = await page.evaluate(() => window.LoomwrightBackend.EntityService.listSync("cast"));
    expect(userEntities.some((e) => e.name === "User-created")).toBe(true);
    const sampleEntities = userEntities.filter((e) => e.source === "sample");
    expect(sampleEntities.length).toBe(0);
  });
});

test.describe("I. Trash", () => {
  test("delete moves entity to trash, restore returns it", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Doomed" }, { status: "active" });
    await page.evaluate(async (id) => {
      await window.LoomwrightBackend.EntityService.delete("cast", id);
    }, cast.id);
    const trashList = await page.evaluate(() => window.LoomwrightBackend.TrashService.listSync());
    expect(trashList.some((t) => t.id === cast.id || t.entityId === cast.id || t.name === "Doomed")).toBe(true);
    await page.evaluate(async (id) => {
      await window.LoomwrightBackend.TrashService.restore(id);
    }, cast.id);
    const live = await page.evaluate(() => window.LoomwrightBackend.EntityService.listSync("cast"));
    expect(live.some((e) => e.id === cast.id || e.name === "Doomed")).toBe(true);
  });
});

test.describe("J. Settings", () => {
  test("requireProviderOrNotice triggers when no key configured", async ({ page }) => {
    await openFreshApp(page);
    const notices = [];
    await page.evaluate(() => {
      window.__TEST_NOTICES__ = [];
      window.addEventListener("lw:backend-notice", (e) => window.__TEST_NOTICES__.push(e.detail?.message || ""));
    });
    await page.evaluate(() => window.LoomwrightDispatchCallback("onGenerateAIWriterDraft", { detail: {} }));
    await page.waitForTimeout(200);
    const collected = await page.evaluate(() => window.__TEST_NOTICES__);
    expect(collected.some((m) => /Configure an AI provider/.test(m))).toBe(true);
  });

  test("merge rewrites references across collections", async ({ page }) => {
    await openFreshApp(page);
    const a = await saveEntity(page, "locations", { name: "Pass A" }, { status: "active" });
    const b = await saveEntity(page, "locations", { name: "Pass B" }, { status: "active" });
    const cast = await saveEntity(page, "cast", { name: "Aelinor", data: { home: a.id } }, { status: "active" });
    await page.evaluate(async ({ aId, bId }) => {
      await window.LoomwrightBackend.LinkService.mergeEntities(bId, "locations", [aId]);
    }, { aId: a.id, bId: b.id });
    const updated = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "cast"), cast.id);
    expect(updated.data.home).toBe(b.id);
  });
});
