// Workflow T21: Area 4 — the Relationships tab graphs the LIVE store.
//
// Verifies that the Relationships workspace renders live cast + relationship
// entities (not the demo Aelinor/Saren constants): the cast bar lists live
// characters, an accepted relationship entity surfaces in the Single view,
// a cast related-multi link also produces an edge, and the Review mode lists
// live relationship candidates from ReviewService.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openRelPanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "relationships" } }));
  });
  await page.locator("[data-ui='RelationshipsPanelBody']").waitFor({ timeout: 5000 });
}

test.describe("T21. Relationships — live rendering", () => {
  test("cast bar + Single view render LIVE cast and an accepted relationship entity", async ({ page }) => {
    await openFreshApp(page);
    // Distinct names so we can prove it's live data, not the demo cast.
    const thane = await saveEntity(page, "cast", { name: "Thane Wolder", data: { role: "protagonist", summary: "Warden of the Ash Marches." } }, { status: "active" });
    const kess = await saveEntity(page, "cast", { name: "Kess Marrow", data: { role: "antagonist", summary: "Reeve of the salt-roads." } }, { status: "active" });
    // An accepted relationship entity (the shape the extraction accept flow lands).
    await saveEntity(page, "relationships", {
      name: "Thane Wolder → Kess Marrow",
      data: { fromId: thane.id, toId: kess.id, relationshipType: "betrayed", summary: "Kess sold Thane's march to the salt-reeves." },
    }, { status: "active" });

    await openRelPanel(page);

    // Cast bar shows the live first names (and NOT the demo cast).
    const bar = page.locator(".rel-bar__cast");
    await expect(bar).toContainText("Thane");
    await expect(bar).toContainText("Kess");
    await expect(bar).not.toContainText("Aelinor");

    // Single view (default) for the protagonist shows the live relationship.
    const single = page.locator(".rel-single");
    await expect(single).toBeVisible();
    await expect(single).toContainText("Thane Wolder");
    await expect(single).toContainText("Kess Marrow");
    // "betrayed" normalises to the Enemy type group.
    await expect(single).toContainText(/Enem/i);
  });

  test("a cast related-multi link produces a relationship edge", async ({ page }) => {
    await openFreshApp(page);
    const kess = await saveEntity(page, "cast", { name: "Kess Marrow", data: { role: "supporting", summary: "Reeve of the salt-roads." } }, { status: "active" });
    // Thane lists Kess as an ally — no explicit relationships entity.
    await saveEntity(page, "cast", {
      name: "Thane Wolder",
      data: { role: "protagonist", summary: "Warden of the Ash Marches.", allies: [{ id: kess.id, name: kess.name, type: "cast" }] },
    }, { status: "active" });

    await openRelPanel(page);
    const single = page.locator(".rel-single");
    await expect(single).toBeVisible();
    await expect(single).toContainText("Kess Marrow");
    // Ally normalises to the Friend group.
    await expect(single).toContainText(/Friend/i);
  });

  test("Review mode lists live relationship candidates from ReviewService", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Thane Wolder", data: { role: "protagonist" } }, { status: "active" });
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "rq-live-1",
        entityType: "relationships",
        name: "Thane ↔ the Ash Court",
        confidence: 0.82,
        sourceQuote: "the court owed Thane a debt it would not name",
        chapterNum: 4,
        suggestedAction: "create",
        status: "pending",
      });
    });

    await openRelPanel(page);
    // Switch to Review mode.
    await page.locator(".rel-bar__mode[data-mode='review']").click();
    const review = page.locator(".rel-review");
    await expect(review).toBeVisible();
    await expect(review).toContainText("Thane ↔ the Ash Court");
    await expect(review).toContainText("the court owed Thane a debt");
  });
});
