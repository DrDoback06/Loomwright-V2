// Workflow T89: phone-usable full-screen EDITORS (Skill tree, Atlas). The
// 3-column desks collapse to a full-screen touch canvas; the side rails become
// slide-up drawers toggled by round edge buttons (a backdrop closes them).

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.describe("T89. Mobile full-screen editors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/Loomwright%20Shell.html");
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    const wired = await page.evaluate(() => typeof window.MobileBottomNav !== "undefined");
    test.skip(!wired, "mobile shell not wired into the dev shell yet");
  });

  test("skill-tree editor: full-width canvas + slide-up rail drawers", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => { await window.LoomwrightBackend.SkillTreeService.addTree({ name: "Constellation" }); });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "skillTrees" } })));
    const panel = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-skillTrees']").first();
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Open the full-screen editor from the side panel.
    await panel.locator("[data-callback='onOpenSkillTreeEditor']").first().click();
    const editor = page.locator("[data-ui='SkillTreeEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Canvas is full-width: the 3-column desk is now a single column.
    const tracks = await editor.locator(".ste__body").evaluate((el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
    expect(tracks).toBe(1);

    // Edge buttons are present; rails are off-canvas by default.
    await expect(page.locator("[data-testid='ste-mobile-left']")).toBeVisible();
    await expect(page.locator("[data-testid='ste-mobile-right']")).toBeVisible();
    await expect(editor).toHaveAttribute("data-mobile-drawer", "");

    // Tap the left edge button → left rail slides in over a backdrop.
    await page.locator("[data-testid='ste-mobile-left']").click();
    await expect(editor).toHaveAttribute("data-mobile-drawer", "left");
    await expect(page.locator("[data-testid='ste-drawer-backdrop']")).toBeVisible();
    // The left rail is now within the editor viewport.
    const railBox = await editor.locator(".ste__rail--left").boundingBox();
    const edBox = await editor.boundingBox();
    expect(railBox.y).toBeLessThan(edBox.y + edBox.height);

    // Backdrop tap closes it.
    await page.locator("[data-testid='ste-drawer-backdrop']").click();
    await expect(editor).toHaveAttribute("data-mobile-drawer", "");
  });
});
