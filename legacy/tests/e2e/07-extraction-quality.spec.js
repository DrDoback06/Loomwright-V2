// Workflow K (Extraction Quality Pass 1):
//   - local detectors produce item-ownership candidates without AI
//   - persisted EntityOccurrence records survive reload
//   - accept on an "update" candidate with suggestedChanges applies only
//     the diff to entity.data (not a wholesale replace)

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity } = require("./helpers");

test.describe("K. Extraction quality — local detectors + persistence + accept", () => {
  test("item-ownership detector creates an update candidate with suggestedChanges.ownerId", async ({ page }) => {
    await openFreshApp(page);
    const aelinor = await saveEntity(page, "cast", { name: "Aelinor" }, { status: "active" });
    const saren   = await saveEntity(page, "cast", { name: "Saren" },   { status: "active" });
    const auger   = await saveEntity(page, "items", { name: "Auger of Hess" }, { status: "active" });
    const chapterId = "ch-e2e-extraction";
    const text = "Aelinor handed the Auger of Hess to Saren without a word.";
    const result = await page.evaluate(async ({ cid, t }) => {
      return await window.LoomwrightBackend.ExtractionService.runExtraction({
        chapterId: cid, text: t, deep: false,
      });
    }, { cid: chapterId, t: text });
    expect((result.occurrences || []).length).toBeGreaterThanOrEqual(3);
    const queue = await page.evaluate(() => window.LoomwrightBackend.ReviewService.listSync());
    const candidate = queue.find((q) => q.entityType === "items" && q.suggestedAction === "update" && q.suggestedChanges?.ownerId === saren.id);
    expect(candidate).toBeTruthy();
    expect(candidate.matchType).toBe("exact");
    expect(candidate.existingEntityId).toBe(auger.id);
    expect(candidate.sourceQuote).toContain("handed");
  });

  test("occurrences persist across reload and remain bound to real entityIds", async ({ page }) => {
    await openFreshApp(page);
    const aelinor = await saveEntity(page, "cast", { name: "Aelinor" }, { status: "active" });
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ExtractionService.runExtraction({
        chapterId: "ch-e2e-persist",
        text: "Aelinor stood at the parapet.",
        deep: false,
      });
    });
    await openAppPreserveState(page);
    const occs = await page.evaluate(() => window.LoomwrightBackend.OccurrenceService.listByChapterSync("ch-e2e-persist"));
    expect(occs.some((o) => o.entityId === aelinor.id && o.exactText === "Aelinor")).toBe(true);
  });

  test("accept on update+suggestedChanges applies only the diff", async ({ page }) => {
    await openFreshApp(page);
    const aelinor = await saveEntity(page, "cast", { name: "Aelinor" }, { status: "active" });
    const saren   = await saveEntity(page, "cast", { name: "Saren" },   { status: "active" });
    const auger   = await saveEntity(page, "items", { name: "Auger of Hess", data: { rarity: "rare" } }, { status: "active" });
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ExtractionService.runExtraction({
        chapterId: "ch-e2e-accept",
        text: "Aelinor handed the Auger of Hess to Saren without a word.",
        deep: false,
      });
    });
    const queue = await page.evaluate(() => window.LoomwrightBackend.ReviewService.listSync());
    const candidate = queue.find((q) => q.entityType === "items" && q.suggestedAction === "update" && q.suggestedChanges?.ownerId === saren.id);
    expect(candidate).toBeTruthy();
    await page.evaluate((id) => window.LoomwrightDispatchCallback("onAcceptQueueItem", { detail: { id } }), candidate.id);
    await page.waitForTimeout(200);
    const updated = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "items"), auger.id);
    expect(updated.data.ownerId).toBe(saren.id);
    // Pre-existing field must be preserved by the diff-only apply.
    expect(updated.data.rarity).toBe("rare");
  });
});
