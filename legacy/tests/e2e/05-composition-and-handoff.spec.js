// Workflows F + G: composition overlay + AI Handoff import.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity } = require("./helpers");

test.describe("F. Composition overlay", () => {
  test("drop entity into composition persists", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Aelinor" }, { status: "active" });
    await page.evaluate((id) => window.dispatchEvent(new CustomEvent("lw:drop-to-composition", {
      detail: { id, entityType: "cast", name: "Aelinor", summary: "Protagonist" },
    })), cast.id);
    await page.waitForTimeout(100);
    const comp = await page.evaluate(() => window.LoomwrightBackend.CompositionService.loadSync({}));
    expect(comp.entities.some((e) => e.id === cast.id)).toBe(true);
  });

  test("create chapter from composition produces a chapter", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(() => window.LoomwrightDispatchCallback("onCreateChapterFromComposition", { detail: { title: "Test Chapter" } }));
    await page.waitForTimeout(150);
    const state = await page.evaluate(() => window.LoomwrightBackend.ManuscriptChapterService.loadSync());
    expect((state.chapters || []).some((c) => c.title === "Test Chapter")).toBe(true);
  });
});

test.describe("G. AI Handoff", () => {
  test("import result in review mode creates queue items", async ({ page }) => {
    await openFreshApp(page);
    const payload = {
      mode: "review",
      result: {
        suggestedReviewItems: [
          { kind: "candidate", payload: { type: "cast", name: "Imported Cast" }, reason: "From AI" },
          { kind: "candidate", payload: { type: "locations", name: "Imported Place" }, reason: "From AI" },
        ],
      },
    };
    await page.evaluate(async (p) => {
      window.dispatchEvent(new CustomEvent("lw:ai-handoff-import", { detail: p }));
      await new Promise((r) => setTimeout(r, 200));
    }, payload);
    const queue = await page.evaluate(() => window.LoomwrightBackend.ReviewService.listSync());
    expect(queue.some((q) => q.name === "Imported Cast" || q.payload?.name === "Imported Cast")).toBe(true);
  });

  test("import result in updateEntities mode patches existing", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Aelinor", summary: "Old summary" }, { status: "active" });
    await page.evaluate(async (id) => {
      window.dispatchEvent(new CustomEvent("lw:ai-handoff-update-entities", {
        detail: {
          mode: "updateEntities",
          result: { entityUpdates: [{ id, type: "cast", patch: { summary: "New summary" } }] },
        },
      }));
      await new Promise((r) => setTimeout(r, 200));
    }, cast.id);
    const updated = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "cast"), cast.id);
    expect(updated.summary).toBe("New summary");
  });
});
