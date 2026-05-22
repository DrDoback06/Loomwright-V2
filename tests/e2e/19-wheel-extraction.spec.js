// Workflow T19: pre-Area-3 fixes pass.
//   Fix A — onboarding JSON paste tolerates ```json fences.
//   Fix C — the adaptive wheel is the standard AI / extraction surface:
//           right-click / long-press over the manuscript opens a context-aware
//           wheel; selection → Extract, chapter → Extract chapter (+ Deep · AI).
//           The toolbar's Save & Extract / Save & Deep buttons are retired.
//   Fix B — responsive Writer's Room: mobile margins become bottom-sheet
//           drawers; the margin resizer works with touch pointers.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

const SHELL_PATH = "/Loomwright%20Shell.html";

async function gotoRoute(page, routeId) {
  await page.evaluate((r) => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: r } })), routeId);
  await page.waitForTimeout(250);
}

async function freshFirstRun(page) {
  await page.goto(SHELL_PATH);
  await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
  await page.evaluate(async () => {
    try { await window.LoomwrightBackend.StorageService.clear(); } catch (_) {}
    try { window.localStorage.clear(); } catch (_) {}
    try { await window.LoomwrightBackend.OnboardingService.setStatus("pending"); } catch (_) {}
  });
  await page.goto(SHELL_PATH);
  await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
}

async function startTyping(page, text) {
  await expect(page.locator("[data-ui='ManuscriptCanvas']").first()).toBeVisible({ timeout: 10000 });
  await page.locator("[data-testid='wr-start-writing']").dispatchEvent("click");
  await page.waitForTimeout(150);
  await page.locator("[data-testid='wr-manuscript-body']").focus();
  await page.keyboard.type(text);
  await page.waitForTimeout(150);
  return await page.locator("[data-ui='ManuscriptCanvas']").first().getAttribute("data-chapter-id");
}

test.describe("T19. Adaptive wheel extraction + responsive Writer's Room", () => {

  // ---- Fix A ----------------------------------------------------------
  test("onboarding accepts ```json-fenced JSON without a parse error", async ({ page }) => {
    await freshFirstRun(page);
    await expect(page.locator("[data-ui='OnboardingOverlay']")).toBeVisible({ timeout: 6000 });
    // Open the per-step JSON tools drawer, switch to the paste tab.
    await page.locator(".ob-jsontab__handle").click();
    await expect(page.locator("[data-ui='StepJsonTools']")).toBeVisible();
    await page.locator(".ob-jsondrawer__tab:has-text('Paste JSON')").click();
    // Paste AI output wrapped in a markdown code fence (the reported failure).
    const fence = "```";
    const fenced = fence + 'json\n{ "premise": "A reluctant heir hunts a stolen relic." }\n' + fence;
    await page.locator(".ob-jsondrawer__body textarea").fill(fenced);
    // Parses cleanly → valid state, NOT "Invalid JSON".
    await expect(page.locator(".ob-jsonstate--valid")).toBeVisible({ timeout: 4000 });
    await expect(page.locator(".ob-jsonstate--invalid")).toHaveCount(0);
  });

  // ---- Fix C ----------------------------------------------------------
  test("selection → right-click → wheel 'Extract' fills the review queue", async ({ page }) => {
    await openFreshApp(page);
    await gotoRoute(page, "writers-room");
    const chapterId = await startTyping(page, "Lord Brennan crossed into Hesselmark and raised the Sunblade at dawn.");
    // Select the prose, then open the wheel via right-click.
    await page.evaluate(() => {
      const body = document.querySelector("[data-testid='wr-manuscript-body']");
      const range = document.createRange();
      range.selectNodeContents(body);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    await page.locator("[data-testid='wr-manuscript-body']").dispatchEvent("contextmenu");
    await expect(page.locator("[data-testid='adaptive-wheel']")).toBeVisible({ timeout: 4000 });
    // Selection context offers Standard (free) + Deep (BYOK) extraction.
    await expect(page.locator("[data-testid='wheel-extract-standard']")).toBeVisible();
    await expect(page.locator("[data-testid='wheel-extract-deep']")).toBeVisible();
    await page.locator("[data-testid='wheel-extract-standard']").dispatchEvent("click");
    await page.waitForTimeout(1500);
    const cands = await page.evaluate((cid) =>
      window.LoomwrightBackend.ReviewService.listSync().filter((q) => q.chapterId === cid), chapterId);
    expect(cands.length).toBeGreaterThan(0);
  });

  test("chapter (no selection) → right-click → wheel offers chapter extraction; 'Deep · AI' routes deep", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Aelinor", status: "active" }, { status: "active" });
    await gotoRoute(page, "writers-room");
    await startTyping(page, "Aelinor crossed into Hesselmark as Aelinor always did.");
    // Clear any selection so the wheel picks the chapter context.
    await page.evaluate(() => { const s = window.getSelection(); s && s.removeAllRanges(); });
    // Spy on the deep-routing event the wheel dispatches.
    await page.evaluate(() => {
      window.__WHEEL_DEEP_EVT__ = null;
      window.addEventListener("lw:wr-extract-chapter", (e) => { window.__WHEEL_DEEP_EVT__ = !!(e.detail && e.detail.deep); });
    });
    await page.locator("[data-testid='wr-manuscript-body']").dispatchEvent("contextmenu");
    await expect(page.locator("[data-testid='adaptive-wheel']")).toBeVisible({ timeout: 4000 });
    await expect(page.locator("[data-testid='wheel-extract-chapter-standard']")).toBeVisible();
    await expect(page.locator("[data-testid='wheel-extract-chapter-deep']")).toBeVisible();
    await page.locator("[data-testid='wheel-extract-chapter-deep']").dispatchEvent("click");
    await page.waitForTimeout(400);
    const deep = await page.evaluate(() => window.__WHEEL_DEEP_EVT__);
    expect(deep).toBe(true);
  });

  test("canvasbar shows a plain Save and no Save & Extract / Deep buttons", async ({ page }) => {
    await openFreshApp(page);
    await gotoRoute(page, "writers-room");
    await expect(page.locator("[data-ui='ManuscriptCanvas']").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("[data-testid='wr-save']")).toHaveCount(1);
    await expect(page.locator("[data-testid='wr-save-extract']")).toHaveCount(0);
    await expect(page.locator("[data-testid='wr-save-deep']")).toHaveCount(0);
  });

  // ---- Fix B ----------------------------------------------------------
  test("narrow viewport → mobile drawers + toggle chips", async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await openFreshApp(page);
    await gotoRoute(page, "writers-room");
    const wr = page.locator("[data-ui='WritersRoomScreen']");
    await expect(wr).toBeVisible({ timeout: 10000 });
    await expect(wr).toHaveAttribute("data-mobile", "true");
    // Side margins are out of the flow until a drawer is opened.
    await expect(page.locator(".wr-stage__col--left")).toHaveCount(0);
    // The "Notes" chip opens the left bottom-sheet drawer over a backdrop.
    await page.locator("[data-testid='wr-mobile-notes']").dispatchEvent("click");
    await expect(wr).toHaveAttribute("data-drawer", "left");
    await expect(page.locator(".wr-stage__col--left")).toHaveCount(1);
    await expect(page.locator(".wr-drawer-backdrop")).toBeVisible();
    // Tapping the backdrop closes the drawer.
    await page.locator(".wr-drawer-backdrop").dispatchEvent("click");
    await expect(wr).toHaveAttribute("data-drawer", "none");
    await expect(page.locator(".wr-stage__col--left")).toHaveCount(0);
  });

  test("margin resizer responds to touch pointer drag", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFreshApp(page);
    await gotoRoute(page, "writers-room");
    await expect(page.locator("[data-ui='WritersRoomScreen']")).toBeVisible({ timeout: 10000 });
    const leftCol = page.locator(".wr-stage__col--left");
    await expect(leftCol).toBeVisible();
    const before = (await leftCol.boundingBox()).width;
    const resizer = page.locator(".wr-resize[data-side='left']");
    const box = await resizer.boundingBox();
    const x0 = box.x + box.width / 2;
    const y0 = box.y + box.height / 2;
    // Touch-type pointer drag to the right widens the left margin.
    await resizer.dispatchEvent("pointerdown", { clientX: x0, clientY: y0, pointerId: 1, pointerType: "touch", isPrimary: true });
    await resizer.dispatchEvent("pointermove", { clientX: x0 + 60, clientY: y0, pointerId: 1, pointerType: "touch" });
    await resizer.dispatchEvent("pointerup", { clientX: x0 + 60, clientY: y0, pointerId: 1, pointerType: "touch" });
    await page.waitForTimeout(150);
    const after = (await leftCol.boundingBox()).width;
    expect(after).toBeGreaterThan(before + 10);
  });
});
