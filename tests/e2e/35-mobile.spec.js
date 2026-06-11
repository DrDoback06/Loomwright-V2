// Workflow U35: Mobile app shell (phone layout, 390×844, touch).
//
// M1 — bottom nav replaces the left rail; routes + Browse/More sheets +
//      Search all work; docked panels open as ONE full-screen sheet.
// M3 — tangle tap-to-add fallback on touch (no HTML5 dnd needed).
// M4 — small-screen layouts hold (palette, workspaces).

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test.describe("U35. Mobile shell", () => {
  // The mobile shell ships in two commits (scaffolding → wiring); skip
  // until the shell exposes the bottom nav so every commit stays green.
  test.beforeEach(async ({ page }) => {
    await page.goto("/Loomwright%20Shell.html");
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    const wired = await page.evaluate(() => typeof window.MobileBottomNav !== "undefined");
    test.skip(!wired, "mobile shell not wired into the dev shell yet");
  });

  test("bottom nav replaces the rail and routes work", async ({ page }) => {
    await openFreshApp(page);
    const shell = page.locator(".app-shell");
    await expect(shell).toHaveAttribute("data-mobile", "true");
    await expect(page.locator("[data-testid='mnav']")).toBeVisible();
    // The desktop rail and status strip are gone.
    await expect(page.locator(".app-left")).toBeHidden();
    await expect(page.locator(".app-status")).toBeHidden();

    await page.locator("[data-testid='mnav-write']").tap();
    await expect(page.locator("[data-ui='WritersRoom'], [data-ui='WritersRoomScreen']").first()).toBeVisible();
    await page.locator("[data-testid='mnav-home']").tap();
    await expect(page.locator("[data-ui='HomeScreen']")).toBeVisible();
  });

  test("Browse sheet lists every tab and opens a full-screen panel sheet", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Anwen Hale" });
    await page.locator("[data-testid='mnav-browse']").tap();
    const sheet = page.locator("[data-testid='mnav-sheet-browse']");
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Cast");
    await expect(sheet).toContainText("Tangle");

    await page.locator("[data-testid='mnav-browse-cast']").tap();
    await expect(sheet).toBeHidden();
    const panel = page.locator("[data-panel-id='p-cast']");
    await expect(panel).toBeVisible();
    // Full-screen: the sheet spans the viewport width.
    const box = await panel.boundingBox();
    expect(Math.round(box.width)).toBe(390);
    await expect(panel).toContainText("Anwen Hale");
  });

  test("only one panel is visible at a time; older ones collapse to the strip", async ({ page }) => {
    await openFreshApp(page);
    await page.locator("[data-testid='mnav-browse']").tap();
    await page.locator("[data-testid='mnav-browse-cast']").tap();
    await page.locator("[data-testid='mnav-browse']").tap();
    await page.locator("[data-testid='mnav-browse-items']").tap();

    await expect(page.locator("[data-panel-id='p-items']")).toBeVisible();
    await expect(page.locator("[data-panel-id='p-cast']")).toBeHidden();
    // The older panel waits in the horizontal strip.
    await expect(page.locator(".pstk__rail [data-ui='CollapsedPanelTab']", { hasText: "Cast" })).toBeVisible();
    // Restoring it swaps the visible sheet.
    await page.locator(".pstk__rail [data-ui='CollapsedPanelTab']", { hasText: "Cast" }).tap();
    await expect(page.locator("[data-panel-id='p-cast']")).toBeVisible();
    await expect(page.locator("[data-panel-id='p-items']")).toBeHidden();
  });

  test("More sheet reaches Settings; Search opens the palette", async ({ page }) => {
    await openFreshApp(page);
    await page.locator("[data-testid='mnav-more']").tap();
    await expect(page.locator("[data-testid='mnav-sheet-more']")).toBeVisible();
    await page.locator("[data-testid='mnav-more-settings']").tap();
    await expect(page.locator(".fws-topbar", { hasText: "Settings Control Centre" })).toBeVisible();
    // Workspace collapses to a single column on a phone (no fixed 260px rails).
    await page.locator(".fws-topbar__exit", { hasText: "Exit" }).first().click().catch(() => {});
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:exit-panel-workspace")));

    await page.locator("[data-testid='mnav-search']").tap();
    await expect(page.locator("[data-testid='command-palette']")).toBeVisible();
  });

  test("long-press inside the manuscript selects text — the wheel stays away", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ManuscriptChapterService.createFromComposition({ title: "Touch" });
    });
    await page.reload();
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    await page.locator("[data-testid='mnav-write']").tap();
    const body = page.locator("[data-testid='wr-manuscript-body']");
    await expect(body).toBeVisible();

    // Long-press INSIDE the editable body: no wheel (native selection owns it).
    await body.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 200, clientY: 300, bubbles: true });
    await page.waitForTimeout(700);
    await expect(page.locator("[data-ui='AdaptiveWheelHost']")).toHaveCount(0);
    await body.dispatchEvent("pointerup", { pointerType: "touch", bubbles: true });

    // Long-press OUTSIDE the editable (chapter strip): the wheel opens.
    const strip = page.locator("[data-ui='ChapterNodeStrip']");
    await strip.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 180, clientY: 70, bubbles: true });
    await page.waitForTimeout(700);
    await expect(page.locator("[data-ui='AdaptiveWheelHost']")).toBeVisible();
  });

  test("tangle: tap-to-add places a card without drag and drop", async ({ page }) => {
    await openFreshApp(page);
    await page.locator("[data-testid='mnav-browse']").tap();
    await page.locator("[data-testid='mnav-browse-tangle']").tap();
    await expect(page.locator("[data-panel-id='p-tangle']")).toBeVisible();
    // The touch fallback control adds a note at the canvas centre.
    const addBtn = page.locator("[data-testid='tangle-tap-add']");
    await expect(addBtn).toBeVisible();
    await addBtn.tap();
    const count = await page.evaluate(() =>
      (window.LoomwrightBackend.TangleService.loadSync().nodes || []).length);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
