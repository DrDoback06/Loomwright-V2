// Workflow T21: Area 4 — Relationships tab renders LIVE data.
//
// Verifies that RelationshipsPanelBody is driven by the live store rather
// than the old ATLAS_CAST / RELATIONSHIPS demo constants:
//   - the mode bar's cast list is the live "cast" collection
//   - persisted "relationships" records surface as edges (single + network)
//   - per-cast related-multi fields (allies/enemies/…) also surface as edges
//   - shared-chapter evidence in Compare is derived from real occurrences
//   - the Review tab lists live pending relationship candidates, and Deny
//     resolves the real queue item
//   - empty project → friendly empty state (no demo Aelinor)

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openRelPanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "relationships" } }));
  });
  await page.waitForTimeout(300);
}

test.describe("T21. Relationships — live data", () => {
  test("empty project shows an empty state, not the demo cast", async ({ page }) => {
    await openFreshApp(page);
    await openRelPanel(page);
    const body = page.locator("[data-ui='RelationshipsPanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });
    await expect(body).toContainText(/No characters yet/i);
    // The old demo protagonist must NOT appear.
    await expect(body).not.toContainText("Aelinor");
  });

  test("mode bar lists the LIVE cast (not ATLAS_CAST)", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Theron Vale", data: { role: "protagonist" } }, { status: "active" });
    await saveEntity(page, "cast", { name: "Brennan Kord", data: { role: "antagonist" } }, { status: "active" });
    await openRelPanel(page);
    const bar = page.locator(".rel-bar__cast");
    await expect(bar).toBeVisible({ timeout: 5000 });
    await expect(bar).toContainText("Theron");
    await expect(bar).toContainText("Brennan");
    // Demo names from ATLAS_CAST should be gone.
    await expect(bar).not.toContainText("Saren");
  });

  test("a persisted relationship record renders as an edge in Single view", async ({ page }) => {
    await openFreshApp(page);
    const theron = await saveEntity(page, "cast", { name: "Theron Vale", data: { role: "protagonist" } }, { status: "active" });
    const brennan = await saveEntity(page, "cast", { name: "Brennan Kord", data: { role: "antagonist" } }, { status: "active" });
    // Persist a relationship the way accept/autoApply does (data.fromId/toId/relationshipType).
    await saveEntity(page, "relationships", {
      name: "Theron Vale → Brennan Kord",
      data: { fromId: theron.id, toId: brennan.id, relationshipType: "enemy", relatedEntityIds: [theron.id, brennan.id] },
    }, { status: "active" });
    await openRelPanel(page);
    // Select Theron in the bar, land in single view.
    await page.locator(".rel-bar__cast-b:has-text('Theron')").click();
    const single = page.locator(".rel-single");
    await expect(single).toBeVisible({ timeout: 5000 });
    // The Enemy group + Brennan's card should render.
    await expect(single.locator(".rel-group")).toContainText("Enemy");
    await expect(single.locator(".rel-card__name")).toContainText("Brennan Kord");
  });

  test("per-cast related-multi fields surface as relationships too", async ({ page }) => {
    await openFreshApp(page);
    const mara = await saveEntity(page, "cast", { name: "Mara Sill", data: { role: "supporting" } }, { status: "active" });
    await saveEntity(page, "cast", {
      name: "Theron Vale",
      data: { role: "protagonist", allies: [{ id: mara.id, name: mara.name, type: "cast" }] },
    }, { status: "active" });
    await openRelPanel(page);
    await page.locator(".rel-bar__cast-b:has-text('Theron')").click();
    const single = page.locator(".rel-single");
    await expect(single).toBeVisible({ timeout: 5000 });
    // allies → Friend group.
    await expect(single.locator(".rel-group")).toContainText("Friend");
    await expect(single.locator(".rel-card__name")).toContainText("Mara Sill");
  });

  test("Compare view derives evidence from shared-chapter occurrences", async ({ page }) => {
    await openFreshApp(page);
    const theron = await saveEntity(page, "cast", { name: "Theron Vale", data: { role: "protagonist" } }, { status: "active" });
    const brennan = await saveEntity(page, "cast", { name: "Brennan Kord", data: { role: "antagonist" } }, { status: "active" });
    await saveEntity(page, "relationships", {
      name: "Theron Vale → Brennan Kord",
      data: { fromId: theron.id, toId: brennan.id, relationshipType: "rival", relatedEntityIds: [theron.id, brennan.id] },
    }, { status: "active" });
    await page.evaluate(async ({ tId, bId }) => {
      const B = window.LoomwrightBackend;
      await B.ManuscriptChapterService.save({
        chapters: [{ id: "ch-1", num: 1, title: "Duel", state: "saved", bodyText: "" }],
        activeChapterId: "ch-1",
        manuscripts: { "ch-1": { text: "" } },
        trashedChapters: [],
      });
      await B.OccurrenceService.saveMany([
        { entityId: tId, entityType: "cast", chapterId: "ch-1", exactText: "Theron drew his blade." },
        { entityId: bId, entityType: "cast", chapterId: "ch-1", exactText: "Brennan sneered across the yard." },
      ]);
    }, { tId: theron.id, bId: brennan.id });
    await openRelPanel(page);
    // Switch to Compare mode, ensure both are the pair.
    await page.locator(".rel-bar__mode:has-text('Compare')").click();
    await page.locator(".rel-bar__cast-b:has-text('Theron')").click(); // primary
    await page.locator(".rel-bar__mode:has-text('Compare')").click();
    await page.locator(".rel-bar__cast-b:has-text('Brennan')").click(); // partner
    const compare = page.locator(".rel-compare");
    await expect(compare).toBeVisible({ timeout: 5000 });
    // Meters render, and the real occurrence quotes appear as evidence.
    await expect(compare.locator(".rel-compare__meters")).toBeVisible();
    // Evidence lists both participants' quotes from the shared chapter; assert
    // at least one is present (avoid strict-mode multi-match).
    await expect(compare.locator(".rel-quote").first()).toContainText(/Theron drew his blade|Brennan sneered/);
  });

  test("Review tab lists live relationship candidates and Deny resolves them", async ({ page }) => {
    await openFreshApp(page);
    const theron = await saveEntity(page, "cast", { name: "Theron Vale", data: { role: "protagonist" } }, { status: "active" });
    const brennan = await saveEntity(page, "cast", { name: "Brennan Kord", data: { role: "antagonist" } }, { status: "active" });
    await page.evaluate(async ({ tId, bId }) => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "rq-rel-1",
        entityType: "relationships",
        status: "pending",
        name: "Theron Vale → Brennan Kord",
        suggestedAction: "create",
        confidence: 0.72,
        sourceQuote: "Theron would sooner die than trust Brennan.",
        relatedEntityIds: [tId, bId],
        suggestedChanges: { fromId: tId, toId: bId, relationshipType: "enemy" },
      });
    }, { tId: theron.id, bId: brennan.id });
    await openRelPanel(page);
    await page.locator(".rel-bar__mode:has-text('Review')").click();
    const review = page.locator(".rel-review");
    await expect(review).toBeVisible({ timeout: 5000 });
    await expect(review).toContainText("Theron Vale → Brennan Kord");
    await expect(review).toContainText("Theron would sooner die than trust Brennan.");
    // Deny → the real generic handler resolves the queue item.
    await page.locator(".rel-review__actions button:has-text('Deny')").first().click();
    await page.waitForTimeout(400);
    const stillPending = await page.evaluate(() =>
      window.LoomwrightBackend.ReviewService.listSync("relationships").filter((q) => q.status === "pending").length);
    expect(stillPending).toBe(0);
  });

  test("Network view renders a node per participating cast member", async ({ page }) => {
    await openFreshApp(page);
    const theron = await saveEntity(page, "cast", { name: "Theron Vale", data: { role: "protagonist" } }, { status: "active" });
    const brennan = await saveEntity(page, "cast", { name: "Brennan Kord", data: { role: "antagonist" } }, { status: "active" });
    await saveEntity(page, "relationships", {
      name: "Theron Vale → Brennan Kord",
      data: { fromId: theron.id, toId: brennan.id, relationshipType: "enemy", relatedEntityIds: [theron.id, brennan.id] },
    }, { status: "active" });
    await openRelPanel(page);
    await page.locator(".rel-bar__mode:has-text('Network')").click();
    const net = page.locator(".rel-net__svg");
    await expect(net).toBeVisible({ timeout: 5000 });
    // Two labelled nodes.
    await expect(net).toContainText("Theron Vale");
    await expect(net).toContainText("Brennan Kord");
  });
});
