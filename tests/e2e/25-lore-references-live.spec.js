// Workflow U25: Area 4 phase 5 — Lore/Canon + References panels live.
//
// LorePanelBody renders EntityService("lore") records (band → hard/soft
// canon, contradiction flow) + ProjectIntelService.canonRules as the AI
// instruction list; ReferencesPanelBody renders ReferencesService with
// working AI/canon/style toggles, tagging and archiving.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openPanelKind(page, kind) {
  await page.evaluate((k) => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } }));
  }, kind);
  await page.waitForTimeout(300);
}

test.describe("U25. Lore / Canon + References — live panels", () => {
  test("fresh project shows designed empty states (no demo cards)", async ({ page }) => {
    await openFreshApp(page);
    await openPanelKind(page, "lore");
    const lore = page.locator("[data-ui='LorePanelBody']");
    await expect(lore).toBeVisible();
    await expect(lore.locator("[data-ui='LoreEmpty']")).toBeVisible();
    await expect(lore).not.toContainText("Salt-wraiths");
    await openPanelKind(page, "references");
    const refs = page.locator("[data-ui='ReferencesPanelBody']");
    await expect(refs).toBeVisible();
    await expect(refs.locator("[data-ui='RefsEmpty']")).toBeVisible();
    await expect(refs).not.toContainText("Hess Court Etiquette");
  });

  test("canon facts render live with working band + contradiction flow", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const anwen = await B.EntityService.save("cast", { name: "Anwen Hale" }, { status: "active" });
      await B.EntityService.save("lore", {
        name: "Iron sinks in mist.",
        summary: "Ferries refuse iron cargo on mist days.",
        data: { kind: "rule", band: "canon", includedInAI: true, chapters: ["3"], relatedEntities: [anwen.id] },
      }, { status: "active" });
    });
    await openPanelKind(page, "lore");
    const lore = page.locator("[data-ui='LorePanelBody']");
    const fact = lore.locator(".lore-fact", { hasText: "Iron sinks in mist." });
    await expect(fact).toBeVisible();
    await expect(fact.locator(".lore-fact__hardness")).toHaveText("HARD CANON");
    await expect(fact).toContainText("In Project Intelligence");
    await expect(fact).toContainText("Ch. 3");
    await expect(fact.locator(".lore-fact__chip", { hasText: "Anwen Hale" })).toBeVisible();

    // Band toggle persists.
    await fact.locator("button", { hasText: "→ Soft" }).click();
    await page.waitForTimeout(300);
    await expect(lore.locator(".lore-fact", { hasText: "Iron sinks in mist." }).locator(".lore-fact__hardness")).toHaveText("SOFT CANON");

    // Flag a contradiction → it lands in the Contradictions view.
    await lore.locator(".lore-fact", { hasText: "Iron sinks in mist." }).locator("button", { hasText: "Flag contradiction" }).click();
    await page.waitForTimeout(300);
    await lore.locator(".lore-bar__view", { hasText: "Contradictions" }).click();
    const contra = lore.locator(".lore-contra");
    await expect(contra).toHaveCount(1);
    await contra.locator("button", { hasText: "Keep as canon" }).click();
    await page.waitForTimeout(300);
    const band = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("lore")[0].data.band);
    expect(band).toBe("canon");
  });

  test("AI instructions read and write ProjectIntelService.canonRules", async ({ page }) => {
    await openFreshApp(page);
    await openPanelKind(page, "lore");
    const lore = page.locator("[data-ui='LorePanelBody']");
    await lore.locator(".lore-bar__view", { hasText: "AI instructions" }).click();
    await expect(lore.locator("[data-ui='LoreAiEmpty']")).toBeVisible();
    await lore.locator("[data-testid='lore-ai-add']").click();
    await lore.locator(".lore-ai__input").fill("Never name the river in narrator voice.");
    await lore.locator(".lore-ai__input").press("Enter");
    await page.waitForTimeout(300);
    await expect(lore.locator(".lore-ai__card", { hasText: "Never name the river" })).toBeVisible();
    const rules = await page.evaluate(() =>
      window.LoomwrightBackend.ProjectIntelService.loadSync({}).canonRules);
    expect(rules).toContain("Never name the river in narrator voice.");
    // Remove it again.
    await lore.locator(".lore-ai__card", { hasText: "Never name the river" }).locator("button", { hasText: "Remove" }).click();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() =>
      window.LoomwrightBackend.ProjectIntelService.loadSync({}).canonRules.length);
    expect(after).toBe(0);
  });

  test("references render live with working toggles, tags and archive", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.ReferencesService.save({
        title: "Coastal forts dossier", kind: "research",
        content: "Fort spacing along the coast road follows the old beacon line.",
        tags: ["forts"],
      });
    });
    await openPanelKind(page, "references");
    const refs = page.locator("[data-ui='ReferencesPanelBody']");
    const card = refs.locator(".refs-card", { hasText: "Coastal forts dossier" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Research");
    await expect(card.locator(".refs-card__badge--ai")).toBeVisible();
    await expect(card).toContainText("#forts");

    // AI toggle persists to the service.
    await card.locator("button", { hasText: "Exclude AI" }).click();
    await page.waitForTimeout(300);
    const aiOff = await page.evaluate(() =>
      window.LoomwrightBackend.ReferencesService.listSync()[0].aiContext);
    expect(aiOff).toBe(false);
    await expect(refs.locator(".refs-card .refs-card__badge--off")).toBeVisible();

    // Tagging via the inline input.
    await refs.locator(".refs-card button", { hasText: "Tag" }).click();
    await refs.locator(".refs-card__tag-input").fill("forts, beacons");
    await refs.locator(".refs-card__tag-input").press("Enter");
    await page.waitForTimeout(300);
    await expect(refs.locator(".refs-card", { hasText: "Coastal forts dossier" })).toContainText("#beacons");

    // Archive removes it from the live list (DOM data-callback path).
    await refs.locator(".refs-card button", { hasText: "Archive" }).dispatchEvent("click");
    await page.waitForTimeout(400);
    await expect(refs.locator(".refs-card")).toHaveCount(0);
  });
});
