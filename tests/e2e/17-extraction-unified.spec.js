// Workflow T17: unified extraction surfaces. Proves the shared normaliser,
// multi-entry grouping, the global Edit-candidate modal, and per-row triage
// in the wizard all work against the real backend candidate shape.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedReview(page, overrides = {}) {
  return await page.evaluate(async (o) => {
    const RS = window.LoomwrightBackend.ReviewService;
    const id = "rq-u-" + Math.random().toString(36).slice(2, 8);
    await RS.add({
      id,
      entityType: o.entityType || "locations",
      name: o.name || "Vraskaa",
      suggestedAction: "create",
      matchType: "new",
      confidence: 0.8,
      confidenceBand: "green",
      sourceQuote: o.quote || "the keep of Vraska stood dark",
      candidateId: "c-" + id,
      status: "pending",
      payload: { name: o.name || "Vraskaa" },
    });
    return id;
  }, overrides);
}

test.describe("T17. Unified extraction surfaces", () => {
  test("candidateToCardItem normalises the backend shape + band vocabulary", async ({ page }) => {
    await openFreshApp(page);
    const card = await page.evaluate(() => window.candidateToCardItem({
      id: "x", entityType: "cast", name: "Aelinor", confidenceBand: "blue", confidence: 0.97,
      sourceQuote: "said Aelinor", suggestedAction: "create", suggestedChanges: { aliases: ["Ael"] },
    }));
    expect(card.candidate.name).toBe("Aelinor");
    expect(card.confidence.band).toBe("high"); // blue -> high
    expect(card.mention).toBe("said Aelinor");
    expect(card.candidate.aliases).toContain("Ael");
  });

  test("groupCardItems clusters candidates by shared groupId", async ({ page }) => {
    await openFreshApp(page);
    const groups = await page.evaluate(() => window.groupCardItems([
      window.candidateToCardItem({ id: "a", entityType: "cast", name: "Dave", groupId: "s1" }),
      window.candidateToCardItem({ id: "b", entityType: "locations", name: "Scotland", groupId: "s1" }),
      window.candidateToCardItem({ id: "c", entityType: "locations", name: "Lonely Isle", groupId: "s2" }),
    ]));
    const multi = groups.find((g) => g.members.length > 1);
    expect(multi).toBeTruthy();
    expect(multi.members.length).toBe(2);
    expect(multi.ids).toContain("a");
    expect(multi.ids).toContain("b");
  });

  test("Edit opens the global modal pre-filled, applies edits, creates the entity", async ({ page }) => {
    await openFreshApp(page);
    const id = await seedReview(page, { entityType: "locations", name: "Vraskaa" });
    await page.evaluate((i) => window.LoomwrightDispatchCallback("onEditQueueItem", { detail: { id: i } }), id);
    const modal = page.locator("[data-testid='edit-candidate-modal']");
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(page.locator("[data-testid='edit-name']")).toHaveValue("Vraskaa");
    await page.locator("[data-testid='edit-name']").fill("Vraska Pass");
    await page.locator("[data-testid='edit-accept']").click();
    await expect(modal).toHaveCount(0);
    const live = await page.evaluate(() => window.LoomwrightBackend.EntityService.listSync("locations"));
    expect(live.some((e) => e.name === "Vraska Pass")).toBe(true);
    const stillPending = await page.evaluate((i) => window.LoomwrightBackend.ReviewService.listSync().some((q) => q.id === i && q.status === "pending"), id);
    expect(stillPending).toBe(false);
  });

  test("wizard per-row Accept creates the entity via the shared callback", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const text = "\"We ride at dawn,\" said Theron. Lord Brennan crossed into Hesselmark and raised the Sunblade.";
      await window.LoomwrightBackend.ManuscriptChapterService.save({
        chapters: [{ id: "uz-ch1", num: 1, title: "Arrival", state: "saved", bodyText: text }],
        activeChapterId: "uz-ch1",
        manuscripts: { "uz-ch1": { text, html: "" } },
        trashedChapters: [],
      });
    });
    await page.evaluate(() => window.LoomwrightDispatchCallback("onOpenExtractionWizard", { detail: { scope: "manuscript" } }));
    await expect(page.locator("[data-testid='extraction-wizard']")).toBeVisible({ timeout: 5000 });
    await page.locator("[data-testid='wizard-start']").click();
    await expect(page.locator("[data-testid='wizard-review']")).toBeVisible({ timeout: 15000 });
    const before = await page.evaluate(() => {
      const all = window.LoomwrightBackend.EntityService.listAllSync();
      return Object.values(all).reduce((n, byId) => n + Object.keys(byId || {}).length, 0);
    });
    await page.locator("[data-testid^='wizard-row-accept-']").first().click();
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => {
      const all = window.LoomwrightBackend.EntityService.listAllSync();
      return Object.values(all).reduce((n, byId) => n + Object.keys(byId || {}).length, 0);
    });
    expect(after).toBeGreaterThan(before);
  });

  test("accepting a new relationship candidate lands its fromId/toId on the entity", async ({ page }) => {
    await openFreshApp(page);
    const id = await page.evaluate(async () => {
      const RS = window.LoomwrightBackend.ReviewService;
      const rid = "rq-rel-1";
      await RS.add({
        id: rid, entityType: "relationships", name: "Aelinor → Saren",
        suggestedAction: "create", matchType: "new", confidence: 0.74, confidenceBand: "orange",
        suggestedChanges: { fromId: "cast-a", toId: "cast-b", relationshipType: "ally" },
        relatedEntityIds: ["cast-a", "cast-b"], status: "pending", candidateId: "c-rel-1",
        payload: { name: "Aelinor → Saren" },
      });
      return rid;
    });
    await page.evaluate((i) => window.LoomwrightDispatchCallback("onAcceptQueueItem", { detail: { id: i } }), id);
    await page.waitForTimeout(200);
    const made = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("relationships").find((r) => r.data && r.data.fromId === "cast-a"));
    expect(made).toBeTruthy();
    expect(made.data.toId).toBe("cast-b");
    expect(made.data.relationshipType).toBe("ally");
  });
});
