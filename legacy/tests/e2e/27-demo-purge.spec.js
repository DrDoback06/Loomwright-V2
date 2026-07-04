// Workflow U27: Area 4 phase 7 — demo purge sweep + sample integrity.
//
// Fresh projects must render zero demo content anywhere in the panel
// stack; per-panel Review tabs read ReviewService (one shared card
// mapper); the opt-in sample project still seeds real entities and
// clears back out.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openPanelKind(page, kind) {
  await page.evaluate((k) => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } }));
  }, kind);
  await page.waitForTimeout(250);
}

test.describe("U27. Demo purge — fresh project is truly empty", () => {
  test("entity panels show no demo names on a fresh project", async ({ page }) => {
    await openFreshApp(page);
    for (const kind of ["items", "quests", "events", "bestiary", "factions", "stats", "classes", "races"]) {
      await openPanelKind(page, kind);
    }
    const stack = page.locator(".panel-stack, [data-ui='PanelStack']").first();
    await expect(stack).toBeVisible();
    // Names from the old ENTITY_SAMPLES / *_REVIEW demo fixtures.
    for (const demo of ["Salt-wraith", "Bone Auger", "Auger Wake", "Salt-bearer", "Reach-folk", "Vraska boar"]) {
      await expect(stack).not.toContainText(demo);
    }
    // The demo review-sample globals are gone entirely.
    const globals = await page.evaluate(() => ({
      reviewSamples: typeof window.ENTITY_REVIEW_SAMPLES,
      suggestionSamples: typeof window.ENTITY_SUGGESTION_SAMPLES,
      itemsReview: typeof window.ITEMS_REVIEW,
    }));
    expect(globals.reviewSamples).toBe("undefined");
    expect(globals.suggestionSamples).toBe("undefined");
    expect(globals.itemsReview).toBe("undefined");
  });

  test("per-panel review queue renders live ReviewService cards", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.ReviewService.add({
        id: "rq-u27", entityType: "items", name: "Toll seal",
        suggestedAction: "create", confidence: 0.8, status: "pending",
        sourceQuote: "She pressed the toll seal into the wax.",
        payload: { name: "Toll seal", entityType: "items" },
      });
      window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    });
    await openPanelKind(page, "items");
    const stack = page.locator(".panel-stack, [data-ui='PanelStack']").first();
    await expect(stack).toContainText("Toll seal");
    // The shared card mapper exposes the designed shape.
    const card = await page.evaluate(() =>
      window.LoomwrightBackend.ReviewService.listCardViewsSync("items")[0]);
    expect(card.level).toBe("strong");
    expect(card.sourceQuote).toContain("toll seal");
  });

  test("opt-in sample project still seeds and clears real entities", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.SampleProjectService.loadSample();
    });
    await openPanelKind(page, "classes");
    const stack = page.locator(".panel-stack, [data-ui='PanelStack']").first();
    await expect(stack).toContainText("Salt-bearer");
    // Atlas placements were seeded as real located entities.
    const placed = await page.evaluate(() =>
      window.LoomwrightBackend.AtlasService.listPlacedSync().length);
    expect(placed).toBeGreaterThan(5);
    // Clear the sample → live store empties again.
    await page.evaluate(async () => {
      await window.LoomwrightBackend.SampleProjectService.clearSample();
    });
    await page.waitForTimeout(400);
    const counts = await page.evaluate(() => ({
      classes: window.LoomwrightBackend.EntityService.listSync("classes").filter((e) => e.status !== "deleted").length,
      placed: window.LoomwrightBackend.AtlasService.listPlacedSync().length,
    }));
    expect(counts.classes).toBe(0);
    expect(counts.placed).toBe(0);
    await expect(stack).not.toContainText("Salt-bearer");
  });
});
