// Workflow U34: Extraction quality 2 (Day-1 upgrades).
//
// E1 — AI deep-pass fields survive acceptance onto entity.data.
// E2 — near-duplicate names promote to merge suggestions in the queue.
// E4 — resolved pronouns enrich dossier mention counts.
// E6 — "Fill from manuscript" guides to Review (provider-gated, with a
//      useful no-provider path).

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

test.describe("U34. Extraction quality 2", () => {
  test("accepting a deep-pass item lands its rich fields on the entity", async ({ page }) => {
    await openFreshApp(page);
    const owner = await saveEntity(page, "cast", { name: "Anwen Hale" });
    const candId = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const cand = B.buildCandidate({
        entityType: "items", name: "Iron Seal",
        sourceQuote: "She pressed the iron seal into the wax.",
        payload: { name: "Iron Seal", type: "relic", rarity: "rare", owner: "Anwen Hale", confidence: 0.82 },
      });
      await B.ReviewService.add(cand);
      window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
      return cand.id;
    });
    // Accept through the registry path the review buttons dispatch.
    await page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onAcceptQueueItem", detail: { id } } }));
    }, candId);
    await page.waitForTimeout(600);
    const saved = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("items").find((i) => i.name === "Iron Seal"));
    expect(saved.data.itemType).toBe("relic");
    expect(saved.data.rarity).toBe("rare");
    expect(saved.data.owner.id).toBe(owner.id);
  });

  test("near-duplicate discovery offers a merge instead of a new record", async ({ page }) => {
    await openFreshApp(page);
    const anwen = await saveEntity(page, "cast", { name: "Anwen Hale" });
    const cand = await page.evaluate(() =>
      window.LoomwrightBackend.buildCandidate({ entityType: "cast", name: "Anwem Hales" }));
    expect(cand.matchType).toBe("ambiguous");
    expect(cand.suggestedAction).toBe("merge");
    expect(cand.existingEntityId).toBe(anwen.id);
  });

  test("resolved pronouns raise the dossier mention count", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Anwen Hale", data: { role: "protagonist", pronouns: "she/her" } });
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const text = "Anwen Hale reached the toll gate at dusk. She paid with foreign coin. She did not look back.";
      await B.ManuscriptChapterService.save({
        chapters: [{ id: "u34-c1", num: 1, title: "The Gate" }],
        activeChapterId: "u34-c1",
        manuscripts: { "u34-c1": { html: "", text } },
      });
      await B.ExtractionService.runExtraction({ chapterId: "u34-c1", text, deep: false });
    });
    const counts = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      const hero = B.EntityService.listSync("cast")[0];
      const occs = B.OccurrenceService.listAllSync().filter((o) => o.entityId === hero.id);
      return {
        total: occs.length,
        pronoun: occs.filter((o) => o.isPronounResolution).length,
        named: occs.filter((o) => !o.isPronounResolution).length,
      };
    });
    expect(counts.named).toBeGreaterThanOrEqual(1);
    expect(counts.pronoun).toBe(2); // both "She" sentences resolve
    // The dossier hero shows the boosted total.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } })));
    await page.waitForTimeout(300);
    await page.locator(".cast-row[data-cast-id]").first().click();
    await expect(page.locator("[data-ui='CastDetail']")).toContainText(counts.total + " mentions");
  });

  test("Fill from manuscript: no provider → guidance + pending count routes to Review", async ({ page }) => {
    await openFreshApp(page);
    const hero = await saveEntity(page, "cast", { name: "Anwen Hale", data: { role: "protagonist" } });
    await page.evaluate(async ({ id }) => {
      window.__notices = [];
      window.addEventListener("lw:backend-notice", (e) => window.__notices.push(e.detail?.message || ""));
      const B = window.LoomwrightBackend;
      await B.ReviewService.add({
        id: "rq-u34", entityType: "cast", name: "Anwen Hale", existingEntityId: id,
        status: "pending", suggestedAction: "update", suggestedChanges: { personality: "Wry, unhurried." },
      });
    }, { id: hero.id });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } })));
    await page.waitForTimeout(300);
    await page.locator(".cast-row[data-cast-id]").first().click();
    const fill = page.locator("[data-testid='cast-fill-from-ms']");
    await expect(fill).toBeVisible();
    await fill.click();
    await page.waitForTimeout(500);
    const notices = await page.evaluate(() => window.__notices);
    expect(notices.some((n) => /pending suggestion/i.test(n))).toBe(true);
    // It routed to the Review panel where the pending fill waits.
    await expect(page.locator("[data-testid='rqc-accept-rq-u34']")).toBeVisible();
  });
});
