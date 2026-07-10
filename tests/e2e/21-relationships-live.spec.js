// Workflow T21: Area 4 — Relationships tab renders the LIVE entity store.
//
// Verifies that the Relationships panel is driven by real cast + relationship
// entities (not the ATLAS_CAST / RELATIONSHIPS demo constants): the cast bar
// and graph reflect seeded cast, an accepted relationship entity surfaces in
// the single/network views with the right type, a persisted source quote shows
// as evidence, the review mode lists live relationship candidates, and an empty
// project falls back to the demo so the surface is never blank.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

// The shell transpiles ~70 JSX modules in-browser on first paint, so a cold
// load can be slow on constrained runners. Give each test extra headroom.
test.describe.configure({ timeout: 120_000 });

async function openRelationshipsPanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "relationships" } }));
  });
  const body = page.locator("[data-ui='RelationshipsPanelBody']");
  await expect(body).toBeVisible({ timeout: 5000 });
  return body;
}

// Seed two cast + a standalone relationship entity between them. Names are
// deliberately NOT in the demo cast so any demo bleed-through is caught.
async function seedPair(page, relType, extra = {}) {
  const rowan = await saveEntity(page, "cast", {
    name: "Rowan Vale",
    data: { role: "protagonist", goals: ["Reach the summit"], fears: ["The deep"] },
  }, { status: "active" });
  const kessa = await saveEntity(page, "cast", {
    name: "Kessa Dune",
    data: { role: "antagonist" },
  }, { status: "active" });
  await saveEntity(page, "relationships", {
    name: "Rowan Vale → Kessa Dune",
    summary: "Kessa broke faith at the ridge.",
    data: { fromId: rowan.id, toId: kessa.id, relationshipType: relType, ...(extra.data || {}) },
  }, { status: "active" });
  return { rowan, kessa };
}

test.describe("T21. Relationships — live from the entity store", () => {
  test("cast bar + single view render the LIVE cast, not the demo", async ({ page }) => {
    await openFreshApp(page);
    await seedPair(page, "betrayed");
    const body = await openRelationshipsPanel(page);

    // The cast bar shows the seeded characters (first names) and none of the
    // demo cast (Aelinor / Saren live only in ATLAS_CAST).
    const bar = body.locator(".rel-bar__cast");
    await expect(bar).toContainText("Rowan");
    await expect(bar).toContainText("Kessa");
    await expect(bar).not.toContainText("Aelinor");

    // Single view defaults to the protagonist (Rowan) and lists the live
    // relationship to Kessa. "betrayed" maps to the enemy bucket.
    const single = body.locator(".rel-single");
    await expect(single).toBeVisible();
    await expect(single.locator(".rel-single__name")).toContainText("Rowan Vale");
    await expect(single.locator(".rel-card__name")).toContainText("Kessa");
    await expect(single.locator(".rel-group__head")).toContainText("Enem");
  });

  test("network + conflict views project the accepted relationship", async ({ page }) => {
    await openFreshApp(page);
    await seedPair(page, "betrayed");
    const body = await openRelationshipsPanel(page);

    // Network mode: an edge exists and the legend shows the Enemy type.
    await body.locator(".rel-bar__mode", { hasText: "Network" }).click();
    const net = body.locator(".rel-net");
    await expect(net).toBeVisible();
    await expect(net.locator("svg line")).toHaveCount(1);
    await expect(net.locator(".rel-net__legend")).toContainText("Enemy");

    // Conflict mode: an enemy relationship is high-conflict, so it appears.
    await body.locator(".rel-bar__mode", { hasText: "Conflict" }).click();
    await expect(body.locator(".rel-conflict__row")).toHaveCount(1);
    await expect(body.locator(".rel-conflict__title")).toContainText("Rowan");
  });

  test("persisted source quote surfaces as compare-view evidence", async ({ page }) => {
    await openFreshApp(page);
    const { kessa } = await seedPair(page, "betrayed", {
      data: { sourceQuote: "Rowan turned, and Kessa was already gone." },
    });
    const body = await openRelationshipsPanel(page);

    // Enter compare mode, then pick Kessa as the second character.
    await body.locator(".rel-bar__mode", { hasText: "Compare" }).click();
    await body.locator(".rel-bar__cast-b", { hasText: "Kessa" }).click();
    const compare = body.locator(".rel-compare");
    await expect(compare).toBeVisible();
    await expect(compare.locator(".rel-compare__type-lbl")).toContainText("Enemy");
    await expect(compare.locator(".rel-quote")).toContainText("Kessa was already gone");
  });

  test("review mode lists live relationship candidates", async ({ page }) => {
    await openFreshApp(page);
    await seedPair(page, "betrayed");
    // Queue a pending relationship candidate before the panel mounts.
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "rq-rel-e2e",
        entityType: "relationships",
        name: "Rowan ↔ Mira",
        confidence: 0.82,
        sourceQuote: "Mira watched Rowan from the doorway.",
        chapterId: "ch-x",
        suggestedAction: "create",
        status: "pending",
      });
    });
    const body = await openRelationshipsPanel(page);

    // The review mode badge reflects the live queue count.
    const reviewMode = body.locator(".rel-bar__mode", { hasText: "Review" });
    await expect(reviewMode.locator(".rel-bar__q")).toHaveText("1");
    await reviewMode.click();
    const review = body.locator(".rel-review");
    await expect(review).toBeVisible();
    await expect(review.locator(".rel-review__title")).toContainText("Rowan");
    await expect(review.locator(".rel-review__quote")).toContainText("Mira watched Rowan");
  });

  test("an empty project falls back to the demo graph (never blank)", async ({ page }) => {
    await openFreshApp(page);
    // No cast seeded — the panel should present the demo so the surface reads.
    const body = await openRelationshipsPanel(page);
    await expect(body.locator(".rel-bar__cast")).toContainText("Aelinor");
    await expect(body.locator(".rel-single")).toBeVisible();
  });
});
