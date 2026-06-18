// Workflow T88: mobile passes for the canvas-style panels (Relationships,
// Timeline, Skill trees, Atlas). Their desktop multi-column grids stack so the
// panels render usably on the phone sheet; the SVG/touch canvases are untouched.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.describe("T88. Mobile canvas panels", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/Loomwright%20Shell.html");
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    const wired = await page.evaluate(() => typeof window.MobileBottomNav !== "undefined");
    test.skip(!wired, "mobile shell not wired into the dev shell yet");
  });

  test("the four canvas panels render on the phone sheet", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Aelinor Vey" });
    await saveEntity(page, "cast", { name: "Hess" });

    for (const kind of ["atlas", "relationships", "timeline", "skillTrees"]) {
      await page.evaluate((k) => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } })), kind);
      const panel = page.locator(`[data-ui='SlidingPanel'][data-panel-id='p-${kind}']`).first();
      await expect(panel).toBeVisible({ timeout: 5000 });
    }
  });

  test("skill-tree side panel stacks to a single column on mobile", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "skillTrees" } })));
    const panel = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-skillTrees']").first();
    await expect(panel).toBeVisible({ timeout: 5000 });

    const stp = panel.locator(".stp").first();
    await expect(stp).toBeVisible();
    const tracks = await stp.evaluate((el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
    expect(tracks).toBe(1); // single column (desktop is 200px + 1fr = 2 tracks)
  });
});
