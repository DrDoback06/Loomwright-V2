// Workflow T72: Review Queue — selection + bulk actions. Audit: the core
// triage (Accept/Edit/Merge/Deny per item) works and persists via
// ReviewService + the registry handlers. The gap: the inline review surface
// got inert filter/selection stubs from panel-stack, so the per-item
// checkbox + bulk-actions bar were unreachable. EntityReviewQueue now
// self-manages filters + selection and the card renders a select checkbox.
// This verifies a seeded candidate is selectable and the bulk bar appears.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openBestiaryPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "bestiary" } })));
  await page.waitForTimeout(300);
}

test.describe("T72. Review Queue selection", () => {
  test("a review candidate is selectable -> bulk-actions bar appears", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "rev-test-1", entityType: "bestiary", name: "Auger Wake",
        confidence: 0.8, suggestedAction: "create", matchType: "new",
        sourceQuote: "It stalked the tideline at dusk.",
      });
    });
    await openBestiaryPanel(page);

    // the inline review surface renders the live candidate above the panel body
    const card = page.locator("[data-testid='rqc-rev-test-1']");
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toContainText("Auger Wake");

    // selecting it reveals the bulk-actions bar (was unreachable before the fix)
    await page.locator("[data-testid='rqc-select-rev-test-1']").check();
    await expect(page.getByRole("button", { name: "Accept all" })).toBeVisible({ timeout: 5000 });
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/reviewqueue.png" });
  });
});
