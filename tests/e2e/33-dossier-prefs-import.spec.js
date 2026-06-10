// Workflows U33: Phases 14 + 15.
//
// 14 — Cast dossier provenance + travel: the accepted candidate's
//      sourceQuote leads the quotes as "First evidence"; the Currently
//      fact carries a working "Show on Atlas" hop.
// 15 — Onboarding "Import existing project" completes setup when a real
//      import lands; persisted workspace.* prefs (width/font/margins)
//      apply live to the manuscript canvas and are editable in Settings.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.describe("U33. Dossier provenance / workspace prefs / onboarding import", () => {
  test("dossier shows First evidence and hops to the Atlas", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const gate = await B.EntityService.save("locations", {
        name: "Toll Gate", data: { placed: true, coords: { x: 30, y: 40 }, kind: "city" },
      }, { status: "active" });
      await B.EntityService.save("cast", {
        name: "Anwen Hale",
        data: {
          role: "protagonist",
          currentLocation: { id: gate.id, name: "Toll Gate", type: "locations" },
          sourceQuote: "Anwen reached the toll gate at dusk, coin in hand.",
        },
      }, { status: "active" });
    });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } })));
    await page.waitForTimeout(300);
    await page.locator(".cast-row[data-cast-id]").first().click();
    const dossier = page.locator("[data-ui='CastDetail']");
    await expect(dossier).toBeVisible();
    // Travel fact + working Atlas hop.
    await expect(dossier).toContainText("Currently");
    await expect(dossier).toContainText("Toll Gate");
    await dossier.locator("[data-testid='cast-show-on-atlas']").click();
    await page.waitForTimeout(400);
    await expect(page.locator("[data-ui='AtlasPanelBody']")).toBeVisible();
    // Back to the dossier: provenance quote leads the list.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } })));
    await page.waitForTimeout(300);
    await expect(page.locator("[data-ui='CastDetail']")).toContainText("First evidence");
    await expect(page.locator("[data-ui='CastDetail']")).toContainText("coin in hand");
  });

  test("workspace prefs (width/font) apply live to the manuscript canvas", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.SettingsService.saveSection("workspace", { editorWidth: 560, font: "EB Garamond", margins: true });
      await B.ManuscriptChapterService.save({
        chapters: [{ id: "u33-c1", num: 1, title: "One" }],
        activeChapterId: "u33-c1",
        manuscripts: { "u33-c1": { html: "", text: "Some words." } },
      });
    });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } })));
    await page.waitForTimeout(500);
    const canvas = page.locator("[data-ui='ManuscriptCanvas']").first();
    await expect(canvas).toBeVisible();
    const style = await canvas.getAttribute("style");
    expect(style).toContain("--wr-editor-max: 560px");
    expect(style).toContain("EB Garamond");
    const width = await canvas.evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(width)).toBeLessThanOrEqual(561);
  });

  test("onboarding 'Import existing project' completes setup on import", async ({ page }) => {
    await openFreshApp(page);
    // Re-enter first-run: onboarding pending again.
    await page.evaluate(async () => {
      await window.LoomwrightBackend.OnboardingService.setStatus("pending");
    });
    await page.reload();
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    await page.waitForTimeout(600);
    const wizard = page.locator("[data-ui='OnboardingWizard'], .ob-root, .ob").first();
    await expect(wizard).toBeVisible({ timeout: 8000 });
    // Choose the import start — the action row appears.
    await page.locator(".ob-choice", { hasText: "Import existing project" }).click();
    await expect(page.locator("[data-ui='ObImportNow']")).toBeVisible();
    await expect(page.locator("[data-testid='ob-import-now']")).toBeVisible();
    // A real import lands (service path; the button's file picker is the same flow).
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const payload = await B.ProjectArchiveService.buildExport({});
      payload.entities = { cast: [{ id: "imp-1", type: "cast", name: "Imported Hero", status: "active", data: {} }] };
      await B.ProjectArchiveService.applyImport(payload, { mode: "merge" });
    });
    await page.waitForTimeout(600);
    // Wizard closed itself and marked setup complete.
    const status = await page.evaluate(() => window.LoomwrightBackend.OnboardingService.statusSync());
    expect(status).toBe("complete");
    await expect(page.locator("[data-ui='ObImportNow']")).toHaveCount(0);
    const hero = await page.evaluate(() => window.LoomwrightBackend.EntityService.listSync("cast").map((c) => c.name));
    expect(hero).toContain("Imported Hero");
  });
});
