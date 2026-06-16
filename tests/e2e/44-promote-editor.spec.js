// Workflow T44: "Edit" on a review candidate opens the UNIVERSAL entity
// editor (not the light modal) with the promote flow — Accept & Assign /
// Accept & return to extraction / Revert / Cancel — and accepting saves the
// (possibly edited) entity and resolves the queue item.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedAndOpen(page) {
  await page.evaluate(async () => {
    await window.LoomwrightBackend.ReviewService.add({
      id: "rq-promote",
      entityType: "cast",
      name: "Saren",
      suggestedAction: "create",
      matchType: "new",
      status: "pending",
      confidence: 0.7,
      summary: "A courier out of Hess.",
      suggestedChanges: { aliases: ["Saren of Hess"] },
      sourceQuote: "Saren of Hess crossed the pass",
      chapterId: "ch-1",
    });
    window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "review" } }));
  });
  await expect(page.locator("[data-ui='ReviewPanelBody']")).toBeVisible({ timeout: 8000 });
  await page.locator("[data-testid='rqc-edit-rq-promote']").click();
  await expect(page.locator("[data-ui='EntityEditor']")).toBeVisible({ timeout: 6000 });
}

test.describe("T44. Promote-from-queue universal editor", () => {
  test("Edit opens the universal editor with the four-button promote flow", async ({ page }) => {
    await openFreshApp(page);
    await seedAndOpen(page);
    await expect(page.locator("[data-testid='ee-promote-assign']")).toBeVisible();
    await expect(page.locator("[data-testid='ee-promote-return']")).toBeVisible();
    await expect(page.locator("[data-testid='ee-promote-revert']")).toBeVisible();
    // The normal save buttons are replaced in promote mode.
    await expect(page.locator("[data-callback='onSaveAndAddToComposition']")).toHaveCount(0);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/promote-editor.png" });
  });

  test("Accept & Assign saves the entity and resolves the queue item", async ({ page }) => {
    await openFreshApp(page);
    await seedAndOpen(page);
    await page.locator("[data-testid='ee-promote-assign']").click();
    await expect.poll(async () => page.evaluate(() => {
      const B = window.LoomwrightBackend;
      const cast = B.EntityService.listSync("cast").find((e) => e.name === "Saren");
      const row = B.ReviewService.listSync().find((q) => q.id === "rq-promote");
      return {
        inCast: !!cast,
        keptAlias: !!cast && JSON.stringify(cast).includes("Saren of Hess"),
        stillPending: !!row && row.status === "pending",
      };
    }), { timeout: 6000 }).toEqual({ inCast: true, keptAlias: true, stillPending: false });
  });
});
