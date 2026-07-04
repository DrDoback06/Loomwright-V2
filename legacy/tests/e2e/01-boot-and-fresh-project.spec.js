// Workflow A + B: app boot and fresh-project empty state.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.describe("A. App boot", () => {
  test("loads without fatal console errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await openFreshApp(page);
    // Allow a moment for late hydration.
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test("Writer's Room route is available by default", async ({ page }) => {
    await openFreshApp(page);
    await expect(page.locator("[data-ui='ManuscriptCanvas']").first()).toBeVisible({ timeout: 10000 });
  });

  test("Settings Control Centre opens", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onOpenSettings" } })));
    await expect(page.locator("[data-workspace-id='control-centre']")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("B. Fresh project empty", () => {
  test("no sample entities are silently present", async ({ page }) => {
    await openFreshApp(page);
    const counts = await page.evaluate(() => {
      const ES = window.LoomwrightBackend?.EntityService;
      const all = ES ? ES.listAllSync() : {};
      const out = {};
      for (const [t, byId] of Object.entries(all)) out[t] = Object.keys(byId || {}).length;
      return out;
    });
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  test("Home empty-state card is visible on Home route", async ({ page }) => {
    await openFreshApp(page);
    // app.jsx listens for lw:open-route and calls setRouteId(routeId).
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "home" } })));
    await expect(page.locator("[data-ui='HomeEmptyState']")).toBeVisible({ timeout: 5000 });
  });

  test("panels do not crash when opened on an empty store", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openFreshApp(page);
    for (const kind of ["cast", "locations", "items", "quests", "events", "bestiary", "stats", "references"]) {
      await page.evaluate((k) => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } })), kind);
      await page.waitForTimeout(150);
    }
    expect(errors).toEqual([]);
  });
});
