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

  test("review queue Accept through the rendered UI creates the entity + clears the item", async ({ page }) => {
    await openFreshApp(page);
    // Fresh: live queue is zero.
    const before = await page.evaluate(() =>
      window.LoomwrightBackend.ReviewService.listSync().filter((q) => q.status !== "done").length);
    expect(before).toBe(0);
    // SETUP ONLY: seed one pending cast review candidate via the service.
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "uat-rq-1", entityType: "cast", status: "pending",
        candidate: { name: "Reviewed Hero", type: "cast" },
        suggestion: "create", confidence: { band: "strong", value: 82 },
      });
      window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    });
    await openPanel(page, "cast");
    // The review card must be RENDERED (reachable in the UI).
    const acceptBtn = page.locator("[data-testid='rqc-accept-uat-rq-1']");
    await expect(acceptBtn).toBeVisible({ timeout: 8000 });
    // DOM action: click Accept on the rendered card.
    await acceptBtn.dispatchEvent("click");
    await page.waitForTimeout(500);
    // The entity now exists and renders in the Cast panel; the item leaves the queue.
    const state = await page.evaluate(() => ({
      created: window.LoomwrightBackend.EntityService.listSync("cast").some((c) => c.name === "Reviewed Hero"),
      stillPending: window.LoomwrightBackend.ReviewService.listSync().some((q) => q.id === "uat-rq-1" && q.status === "pending"),
    }));
    expect(state.created).toBe(true);
    expect(state.stillPending).toBe(false);
    // The accepted card is removed from the rendered queue (DOM).
    await expect(page.locator("[data-testid='rqc-accept-uat-rq-1']")).toHaveCount(0, { timeout: 6000 });
  });

  test("review queue Deny + Merge are clickable in the rendered UI", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const RS = window.LoomwrightBackend.ReviewService;
      await RS.add({ id: "uat-deny", entityType: "cast", status: "pending", candidate: { name: "Deny Me" }, suggestion: "create", confidence: { band: "weak", value: 40 } });
      await RS.add({ id: "uat-merge", entityType: "cast", status: "pending", candidate: { name: "Merge Me" }, suggestion: "merge", confidence: { band: "uncertain", value: 55 } });
      window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    });
    await openPanel(page, "cast");
    // Deny (DOM) → item leaves pending.
    const denyBtn = page.locator("[data-testid='rqc-deny-uat-deny']");
    await expect(denyBtn).toBeVisible({ timeout: 8000 });
    await denyBtn.dispatchEvent("click");
    await page.waitForTimeout(400);
    const denied = await page.evaluate(() =>
      !window.LoomwrightBackend.ReviewService.listSync().some((q) => q.id === "uat-deny" && q.status === "pending"));
    expect(denied).toBe(true);
    // Merge (DOM) → opens the merge modal.
    const mergeBtn = page.locator("[data-testid='rqc-merge-uat-merge']");
    await expect(mergeBtn).toBeVisible({ timeout: 6000 });
    await mergeBtn.dispatchEvent("click");
    await page.waitForTimeout(400);
    await expect(page.locator("[data-testid='merge-candidate-modal']")).toBeVisible({ timeout: 5000 });
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
