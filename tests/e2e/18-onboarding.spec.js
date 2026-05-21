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
});
