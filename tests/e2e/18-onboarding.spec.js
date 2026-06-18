// Workflow T18: onboarding wizard — first-run gate, completion seeding, exit.

const { test, expect } = require("@playwright/test");

const SHELL_PATH = "/Loomwright%20Shell.html";

async function freshFirstRun(page) {
  await page.goto(SHELL_PATH);
  await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
  await page.evaluate(async () => {
    try { await window.LoomwrightBackend.StorageService.clear(); } catch (_) {}
    try { window.localStorage.clear(); } catch (_) {}
    try { window.__LW_SAMPLE_LOADED__ = false; } catch (_) {}
    try { await window.LoomwrightBackend.OnboardingService.setStatus("pending"); } catch (_) {}
  });
  await page.goto(SHELL_PATH);
  await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
}

test.describe("T18. Onboarding wizard", () => {
  test("first run shows the wizard; Exit setup closes it and marks skipped", async ({ page }) => {
    await freshFirstRun(page);
    const overlay = page.locator("[data-ui='OnboardingOverlay']");
    await expect(overlay).toBeVisible({ timeout: 6000 });
    await page.locator("button:has-text('Exit setup')").click();
    await expect(overlay).toHaveCount(0);
    const status = await page.evaluate(() => window.LoomwrightBackend.OnboardingService.statusSync());
    expect(status).toBe("skipped");
  });

  test("completion seeds the project (intel + cast + chapters) and closes the wizard", async ({ page }) => {
    await freshFirstRun(page);
    await expect(page.locator("[data-ui='OnboardingOverlay']")).toBeVisible({ timeout: 6000 });
    // Drive the real completion path (the 13-step UI funnels into this).
    await page.evaluate(async () => {
      await window.LoomwrightBackend.OnboardingService.applyCompletion({
        welcome: { title: "The Salt Reach", genre: "Grimdark" },
        foundation: { premise: "A reluctant heir hunts a stolen relic.", toneWords: ["bleak"], pov: "third-limited" },
        style: { narratorTone: "dry" },
        world: { canonRules: ["Magic costs blood"] },
        cast: { seeds: [{ id: "s1", name: "Aelinor Vey", role: "Protagonist", personality: "Wary." }] },
        manuscript: { mode: "paste", autoDetect: true, runExtraction: false, pasted: "Chapter 1 — Arrival\nAelinor Vey rode into Hesselmark." },
        ai: { mode: "local" },
        workspace: { startTab: "writers-room" },
      });
    });
    // The app listens for lw:onboarding-complete → closes the overlay + routes.
    await expect(page.locator("[data-ui='OnboardingOverlay']")).toHaveCount(0, { timeout: 6000 });
    const seeded = await page.evaluate(() => ({
      status: window.LoomwrightBackend.OnboardingService.statusSync(),
      cast: window.LoomwrightBackend.EntityService.listSync("cast").map((e) => e.name),
      chapters: (window.LoomwrightBackend.ManuscriptChapterService.loadSync().chapters || []).map((c) => c.bodyText || ""),
      foundation: window.LoomwrightBackend.ProjectIntelService.loadSync().projectFoundation || "",
    }));
    expect(seeded.status).toBe("complete");
    expect(seeded.cast).toContain("Aelinor Vey");
    expect(seeded.chapters.some((b) => b.includes("Hesselmark"))).toBe(true);
    expect(/reluctant heir/.test(seeded.foundation)).toBe(true);
  });

  test("Cast step: 'Import from pasted text' extracts character seeds offline (NER)", async ({ page }) => {
    await freshFirstRun(page);
    await expect(page.locator("[data-ui='OnboardingOverlay']")).toBeVisible({ timeout: 6000 });
    await page.locator("[data-step='cast']").click();
    await page.locator("button:has-text('Import from pasted text')").click();
    await page.locator("[data-testid='cast-import-text']").fill('"We ride at dawn," said Aelinor. Lord Brennan only nodded. Later, Aelinor found Brennan by the gate.');
    await page.locator("[data-testid='cast-import-run']").click();
    // Discovered seeds render as cards with the character name.
    await expect(page.locator(".ob-card__title:has-text('Aelinor')")).toBeVisible({ timeout: 5000 });
  });

  test("Voice step: Analyze computes real, local style metrics", async ({ page }) => {
    await freshFirstRun(page);
    await expect(page.locator("[data-ui='OnboardingOverlay']")).toBeVisible({ timeout: 6000 });
    await page.locator("[data-step='voice']").click();
    await page.getByPlaceholder(/The auger spoke/).fill("The wolf ran fast. It was a long, careful, deliberate hunt across the frozen waste, and nothing stirred for a while. \"Wait,\" she whispered to the dark.");
    await page.locator("button:has-text('Analyze style')").click();
    await expect(page.locator(".chip:has-text('avg sentence:')")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".ob-card__meta:has-text('Computed locally')")).toBeVisible();
  });

  test("the wizard can be reopened after onboarding is complete", async ({ page }) => {
    await page.goto(SHELL_PATH);
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    await page.evaluate(async () => {
      try { await window.LoomwrightBackend.StorageService.clear(); } catch (_) {}
      try { await window.LoomwrightBackend.OnboardingService.setStatus("complete"); } catch (_) {}
    });
    await page.goto(SHELL_PATH);
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    await page.waitForTimeout(300);
    await expect(page.locator("[data-ui='OnboardingOverlay']")).toHaveCount(0);
    await page.evaluate(() => window.LoomwrightDispatchCallback("onReopenOnboardingWizard", { detail: {} }));
    await expect(page.locator("[data-ui='OnboardingOverlay']")).toBeVisible({ timeout: 5000 });
  });

  test("a project that already onboarded does not reopen the wizard", async ({ page }) => {
    await page.goto(SHELL_PATH);
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    await page.evaluate(async () => {
      try { await window.LoomwrightBackend.StorageService.clear(); } catch (_) {}
      try { await window.LoomwrightBackend.OnboardingService.setStatus("complete"); } catch (_) {}
    });
    await page.goto(SHELL_PATH);
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    await page.waitForTimeout(400);
    await expect(page.locator("[data-ui='OnboardingOverlay']")).toHaveCount(0);
  });

  test("completion seeds factions, locations, classes & races from the setup answers", async ({ page }) => {
    await freshFirstRun(page);
    await expect(page.locator("[data-ui='OnboardingOverlay']")).toBeVisible({ timeout: 6000 });
    await page.evaluate(async () => {
      await window.LoomwrightBackend.OnboardingService.applyCompletion({
        welcome: { title: "The Salt Reach", genre: "Grimdark" },
        foundation: { premise: "A reluctant heir hunts a stolen relic.", toneWords: ["bleak"], povCharacter: "Saren of Hess" },
        world: { factions: "House Vey · House Hess\nThe Mendicants", locations: "Pale Reach, The Auger's Hold" },
        cast: { seeds: [
          { id: "s1", name: "Aelinor Vey", role: "Protagonist", klass: "Diviner, Knight-errant", race: "Diviner-born", faction: "House Vey" },
          { id: "s2", name: "Mara of Hess", role: "Antagonist", klass: "Knight-errant", race: "Hessian", faction: "House Hess" },
        ] },
        rpg: { toggles: { abilities: true }, customAbilityNames: "Auger-sight, Saltbinding" },
        voice: { samples: [{ id: "v1", text: "The auger spoke, low and certain, across the hushed hall." }] },
        ai: { mode: "local" }, workspace: { startTab: "cast" },
      });
    });
    const refTitles = await page.evaluate(async () => (await window.LoomwrightBackend.StorageService.get("references", [])).map((r) => r.title));
    expect(refTitles).toContain("Voice sample 1");   // extra voice samples wired into references (no longer dead)
    const out = await page.evaluate(() => {
      const L = (t) => window.LoomwrightBackend.EntityService.listSync(t).map((e) => e.name);
      const f = window.LoomwrightBackend.EntityService.listSync("factions").find((e) => e.name === "House Vey");
      const a = window.LoomwrightBackend.EntityService.listSync("cast").find((e) => e.name === "Aelinor Vey");
      return { factions: L("factions"), locations: L("locations"), classes: L("classes"), races: L("races"),
               abilities: L("abilities"), cast: L("cast"),
               veyMembers: (f && f.data && f.data.members) || [], aId: a && a.id };
    });
    expect(out.factions).toEqual(expect.arrayContaining(["House Vey", "House Hess", "The Mendicants"]));
    expect(out.locations).toEqual(expect.arrayContaining(["Pale Reach", "The Auger's Hold"]));
    expect(out.classes).toEqual(expect.arrayContaining(["Diviner", "Knight-errant"]));   // multi-class string split
    expect(out.races).toEqual(expect.arrayContaining(["Diviner-born", "Hessian"]));
    expect(out.abilities).toEqual(expect.arrayContaining(["Auger-sight", "Saltbinding"]));  // RPG custom abilities
    expect(out.cast).toContain("Saren of Hess");   // POV character seeded as a lead
    expect(out.veyMembers).toContain(out.aId);   // faction members linked by name
  });
});
