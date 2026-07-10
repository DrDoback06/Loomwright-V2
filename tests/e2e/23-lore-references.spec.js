// Workflow T23: Area 6 — Lore/Canon + References tabs render LIVE data.
//
// LorePanelBody reads the live "lore" entity collection for canon facts and
// the real Project-Intelligence canon rules for AI instructions. Toggles
// persist. ReferencesPanelBody reads ReferencesService (the store onboarding
// seeds into) — not the old demo constant that had become the service's
// fallback, so a fresh project shows an empty state, not 6 fake refs.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openPanel(page, kind) {
  await page.evaluate((k) => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } }));
  }, kind);
  await page.waitForTimeout(300);
}

test.describe("T23. Lore & References — live data", () => {
  test("Lore empty project shows an empty state (no demo salt-wraith fact)", async ({ page }) => {
    await openFreshApp(page);
    await openPanel(page, "lore");
    const body = page.locator("[data-ui='LorePanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });
    await expect(body).toContainText(/No canon facts yet/i);
    await expect(body).not.toContainText("Salt-wraiths");
  });

  test("a live lore entity renders as a canon fact and AI-toggle persists", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "lore", {
      name: "Tidebound oath",
      summary: "An oath sworn on tidewater cannot be broken until the next spring tide.",
      data: { scope: "magic rule", hardness: "hard", confidence: "high", includedInAI: true },
    }, { status: "active" });
    await openPanel(page, "lore");
    const fact = page.locator(".lore-fact", { hasText: "tidewater" });
    await expect(fact).toBeVisible({ timeout: 5000 });
    await expect(fact.locator(".lore-fact__hardness--hard")).toBeVisible();
    await expect(fact).toContainText("In Project Intelligence");
    // Toggle "Exclude from AI" → persists to the entity data.
    await fact.locator("button:has-text('Exclude from AI')").click();
    await page.waitForTimeout(400);
    const included = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      const e = B.EntityService.listSync("lore")[0];
      return e && e.data && e.data.includedInAI;
    });
    expect(included).toBe(false);
  });

  test("AI instructions view shows the live Project-Intelligence canon rules", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const intel = B.ProjectIntelService.loadSync();
      await B.ProjectIntelService.save({ ...intel, canonRules: ["Never give the wraiths eyes."], forbidden: ["moist"] });
    });
    await openPanel(page, "lore");
    const body = page.locator("[data-ui='LorePanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });
    await body.locator(".lore-bar__view:has-text('AI instructions')").click();
    await expect(body.locator(".lore-ai")).toContainText("Never give the wraiths eyes.");
    await expect(body.locator(".lore-ai")).toContainText("Never use: moist");
  });

  test("References empty project shows an empty state, not the 6 demo refs", async ({ page }) => {
    await openFreshApp(page);
    await openPanel(page, "references");
    const body = page.locator("[data-ui='ReferencesPanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });
    await expect(body).toContainText(/No references yet/i);
    // Old demo reference titles must NOT appear.
    await expect(body).not.toContainText("Hess Court Etiquette");
    await expect(body).not.toContainText("voice profile");
  });

  test("a live reference renders and the AI-context toggle + archive persist", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReferencesService.save({
        title: "Harbour cant glossary",
        kind: "research",
        content: "A glossary of dockside slang used along the tin coast, gathered over three seasons.",
        aiContext: true,
        tags: ["worldbuilding", "language"],
      });
    });
    await openPanel(page, "references");
    const card = page.locator(".refs-card", { hasText: "Harbour cant glossary" });
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toContainText("In AI context");
    await expect(card).toContainText("#worldbuilding");
    // Toggle exclude → persists.
    await card.locator("button:has-text('Exclude AI')").click();
    await page.waitForTimeout(400);
    const ai = await page.evaluate(() => window.LoomwrightBackend.ReferencesService.listSync()[0].aiContext);
    expect(ai).toBe(false);
    // Archive → the card leaves the list.
    await page.locator(".refs-card button:has-text('Archive')").first().click();
    await page.waitForTimeout(400);
    await expect(page.locator(".refs-card", { hasText: "Harbour cant glossary" })).toHaveCount(0);
  });
});
