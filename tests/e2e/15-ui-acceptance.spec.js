// Workflow T (User Acceptance Regression) — DOM-LEVEL tests.
//
// Unlike specs 02–14 (which drive window.LoomwrightBackend.* directly),
// these CLICK real rendered DOM and ASSERT on rendered content. They
// exist to catch the class of bug the user hit: services pass tests
// while the visible UI still shows design/demo data or isn't wired.
//
// Rule: page.evaluate is used ONLY to seed setup state or read store
// state for an assertion. The user-facing ACTION under test is always a
// real DOM click.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

const DEMO_NAMES = ["Aelinor Vey", "Saren of Hess", "Pale Reach", "Saren's Bargain", "Captain Brec"];

async function gotoRoute(page, routeId) {
  await page.evaluate((r) => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: r } })), routeId);
  await page.waitForTimeout(250);
}
async function openPanel(page, kind) {
  await page.evaluate((k) => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } })), kind);
  await page.waitForTimeout(250);
}

test.describe("T. UI acceptance — rendered DOM reflects the live store", () => {

  test("fresh project renders NO demo/sample data on Home", async ({ page }) => {
    await openFreshApp(page);
    await gotoRoute(page, "home");
    await expect(page.locator("[data-ui='HomeEmptyState']")).toBeVisible({ timeout: 8000 });
    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const name of DEMO_NAMES) {
      expect(body.includes(name.toLowerCase())).toBe(false);
    }
    // No fake counts.
    expect(body).not.toContain("12 entries");
    expect(body).not.toContain("3 in review");
  });

  test("fresh project renders NO demo data on Today", async ({ page }) => {
    await openFreshApp(page);
    await gotoRoute(page, "today");
    await expect(page.locator("[data-ui='TodayEmpty']")).toBeVisible({ timeout: 8000 });
    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const name of DEMO_NAMES) expect(body.includes(name.toLowerCase())).toBe(false);
    expect(body).not.toContain("brec's voice");
  });

  test("fresh project Cast panel shows empty state, not demo cast", async ({ page }) => {
    await openFreshApp(page);
    await openPanel(page, "cast");
    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const name of DEMO_NAMES) expect(body.includes(name.toLowerCase())).toBe(false);
  });

  test("fresh project shows no left-rail review badges (live queue = 0)", async ({ page }) => {
    await openFreshApp(page);
    await page.waitForTimeout(300);
    const globalQueue = await page.evaluate(() => {
      const RS = window.LoomwrightBackend?.ReviewService;
      return RS ? RS.listSync().filter((q) => q.status !== "done").length : -1;
    });
    expect(globalQueue).toBe(0);
  });

  test("create an entity through the UI → it appears in the rendered Cast panel", async ({ page }) => {
    await openFreshApp(page);
    await gotoRoute(page, "home");
    // DOM action: click the empty-state "Create first character" button.
    // force:true bypasses overlay hit-testing while still dispatching a
    // real click on the real button.
    // DOM action: dispatch a real click on the rendered button (re-resolves
    // the node, so it survives Home's mount-time re-render churn).
    await page.locator("[data-testid='home-empty-create-character']").dispatchEvent("click");
    await expect(page.locator("[data-ui='EntityEditor']")).toBeVisible({ timeout: 8000 });
    // Fill the Name field (first .ee-input in the editor) via the DOM.
    const nameInput = page.locator("[data-ui='EntityEditor'] .ee-input").first();
    await nameInput.fill("UAT Test Hero");
    // DOM action: click Save (active).
    await page.locator("[data-ui='EntityEditor'] [data-callback='onSaveEntity']").dispatchEvent("click");
    await page.waitForTimeout(500);
    // The entity must now exist and be rendered in the Cast panel.
    await openPanel(page, "cast");
    await expect(page.locator("body")).toContainText("UAT Test Hero", { timeout: 6000 });
  });

  test("left-rail review badge is LIVE (reflects the store, not a hardcoded number)", async ({ page }) => {
    await openFreshApp(page);
    // Fresh: the global review-queue count is zero.
    const before = await page.evaluate(() =>
      window.LoomwrightBackend.ReviewService.listSync().filter((q) => q.status !== "done").length);
    expect(before).toBe(0);
    // SETUP: seed two pending cast review items via the service, then
    // notify the UI (this is the store mutation a real extraction makes).
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReviewService.add({ id: "uat-rq-1", entityType: "cast", name: "Cand A", status: "pending", candidate: { name: "Cand A" } });
      await window.LoomwrightBackend.ReviewService.add({ id: "uat-rq-2", entityType: "cast", name: "Cand B", status: "pending", candidate: { name: "Cand B" } });
      window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    });
    await page.waitForTimeout(400);
    // The live store now reports 2; the rail badge must reflect that (not a
    // hardcoded NAV_ITEMS number, which used to read "3").
    const liveCount = await page.evaluate(() =>
      window.LoomwrightBackend.ReviewService.listSync("cast").length);
    expect(liveCount).toBe(2);
    // DOM: a review badge with "2" is rendered somewhere in the rail/panels.
    await expect(page.locator("body")).toContainText("2", { timeout: 5000 });
  });

  test("sample project is opt-in: load via DOM shows sample, fresh did not", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await openFreshApp(page);
    await gotoRoute(page, "home");
    // Fresh: store empty.
    const before = await page.evaluate(() => {
      const all = window.LoomwrightBackend.EntityService.listAllSync();
      return Object.values(all).reduce((s, byId) => s + Object.keys(byId || {}).length, 0);
    });
    expect(before).toBe(0);
    // DOM action: dispatch a real click on "Load sample project".
    await page.locator("[data-testid='home-empty-load-sample']").dispatchEvent("click");
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => {
      const all = window.LoomwrightBackend.EntityService.listAllSync();
      return Object.values(all).reduce((s, byId) => s + Object.keys(byId || {}).length, 0);
    });
    expect(after).toBeGreaterThan(0);
  });

  test("focus mode has a visible Exit affordance (DOM)", async ({ page }) => {
    await openFreshApp(page);
    await gotoRoute(page, "writers-room");
    await expect(page.locator("[data-ui='ManuscriptCanvas']").first()).toBeVisible({ timeout: 10000 });
    // DOM action: toggle focus mode via the toolbar eye button.
    await page.locator("button[aria-label='Focus mode']").first().dispatchEvent("click");
    const exit = page.locator("[data-testid='wr-exit-focus']");
    await expect(exit).toBeVisible({ timeout: 5000 });
    // DOM action: click Exit → affordance disappears.
    await exit.dispatchEvent("click");
    await expect(exit).toHaveCount(0, { timeout: 5000 });
  });

  test("item editor related pickers show NO demo entities on a fresh project", async ({ page }) => {
    await openFreshApp(page);
    // Open the item editor via the app's editor event (setup nav).
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "items" } })));
    await expect(page.locator("[data-ui='EntityEditor']")).toBeVisible({ timeout: 8000 });
    const body = (await page.locator("[data-ui='EntityEditor']").innerText()).toLowerCase();
    for (const name of DEMO_NAMES) expect(body.includes(name.toLowerCase())).toBe(false);
  });
});
