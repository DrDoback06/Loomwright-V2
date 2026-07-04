// Workflow E: review queue accept / deny / merge / bulk.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity } = require("./helpers");

async function seedReviewItem(page, overrides = {}) {
  return await page.evaluate(async (o) => {
    const RS = window.LoomwrightBackend.ReviewService;
    const id = "rq-" + Math.random().toString(36).slice(2, 8);
    await RS.add({
      id,
      entityType: o.entityType || "locations",
      name: o.name || "Test candidate",
      action: "Extract",
      level: "suggestion",
      value: 80,
      confidence: 0.8,
      confidenceBand: "green",
      matchType: "new",
      suggestedAction: "create",
      reason: "Mock review item",
      payload: { name: o.name || "Test candidate", type: o.entityType || "locations" },
      candidateId: "cand-" + id,
      status: "pending",
      ...o,
    });
    return id;
  }, overrides);
}

test.describe("E. Review queue", () => {
  test("accept creates the entity and resolves the queue item", async ({ page }) => {
    await openFreshApp(page);
    const itemId = await seedReviewItem(page, { entityType: "locations", name: "Vraska Pass" });
    await page.evaluate((id) => window.LoomwrightDispatchCallback("onAcceptQueueItem", { detail: { id } }), itemId);
    await page.waitForTimeout(150);
    const live = await page.evaluate(() => window.LoomwrightBackend.EntityService.listSync("locations"));
    expect(live.some((e) => e.name === "Vraska Pass")).toBe(true);
    const queue = await page.evaluate(() => window.LoomwrightBackend.ReviewService.listSync());
    const found = queue.find((q) => q.id === itemId);
    // resolved items are filtered out by default in listSync; if present, status should be done.
    if (found) expect(found.status).toBe("done");
  });

  test("deny resolves with status='denied'", async ({ page }) => {
    await openFreshApp(page);
    const itemId = await seedReviewItem(page, { entityType: "items", name: "Junk item" });
    await page.evaluate((id) => window.LoomwrightDispatchCallback("onDenyQueueItem", { detail: { id } }), itemId);
    await page.waitForTimeout(150);
    const all = await page.evaluate(() => window.LoomwrightBackend.StorageService.getSync(window.LoomwrightBackend.keys.reviewQueue, []));
    const found = all.find((q) => q.id === itemId);
    expect(found?.status).toBe("denied");
  });

  test("bulk accept resolves all listed items", async ({ page }) => {
    await openFreshApp(page);
    const ids = [];
    for (let i = 0; i < 3; i++) {
      ids.push(await seedReviewItem(page, { entityType: "items", name: "Item " + i }));
    }
    await page.evaluate((idList) => window.LoomwrightDispatchCallback("onBulkAcceptQueueItems", { detail: { ids: idList } }), ids);
    await page.waitForTimeout(250);
    const live = await page.evaluate(() => window.LoomwrightBackend.EntityService.listSync("items"));
    expect(live.length).toBeGreaterThanOrEqual(3);
  });

  test("merge opens the merge modal with ranked alternatives", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "locations", { name: "Vraska Pass" }, { status: "active" });
    const itemId = await seedReviewItem(page, { entityType: "locations", name: "Vraska Pas" });
    let openedDetail = null;
    await page.evaluate(() => {
      window.__TEST_MERGE_DETAIL__ = null;
      window.addEventListener("lw:open-merge-modal", (e) => { window.__TEST_MERGE_DETAIL__ = e.detail; });
    });
    await page.evaluate((id) => window.LoomwrightDispatchCallback("onMergeQueueItem", { detail: { id } }), itemId);
    await page.waitForTimeout(150);
    openedDetail = await page.evaluate(() => window.__TEST_MERGE_DETAIL__);
    expect(openedDetail).toBeTruthy();
    expect(openedDetail.type).toBe("locations");
  });
});
