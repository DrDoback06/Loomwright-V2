// Workflow T71: References tab — regression. Audit: fully functional +
// persistent — reads live ReferencesService.listSync(), and tag edits +
// AI-context/canon/style toggles + archive all persist via
// ReferencesService.save(). This locks that in: a seeded reference renders
// and the AI-context toggle round-trips through the store.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openReferencesPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "references" } })));
  await page.waitForTimeout(300);
}

test.describe("T71. References tab", () => {
  test("a reference renders live + AI-context toggle persists", async ({ page }) => {
    await openFreshApp(page);
    const refId = await page.evaluate(async () => {
      const r = await window.LoomwrightBackend.ReferencesService.save({
        title: "Tide chart of the Reach", kind: "note",
        content: "Twice-daily tides; spring tides at the new moon.",
        tags: ["tides", "geography"], aiContext: true,
      });
      return r.id;
    });
    await openReferencesPanel(page);
    const panel = page.locator("[data-ui='ReferencesPanelBody']");
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel).toContainText("Tide chart of the Reach"); // live reference
    await expect(panel).toContainText("Twice-daily tides");        // excerpt from content

    // toggle AI context -> persists via ReferencesService.save
    const card = page.locator(".refs-card", { hasText: "Tide chart" });
    await card.getByRole("button", { name: /AI/ }).click();
    await page.waitForTimeout(250);
    const aiCtx = await page.evaluate((id) => {
      const r = window.LoomwrightBackend.ReferencesService.listSync().find((x) => x.id === id);
      return r.aiContext;
    }, refId);
    expect(aiCtx).toBe(false);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/references.png" });
  });
});
