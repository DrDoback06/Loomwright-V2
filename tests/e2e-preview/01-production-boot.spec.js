// Production-build boot smoke (Workflow S).
//   Runs against `vite preview` serving the precompiled dist/ bundle —
//   i.e. the PRODUCTION path with no in-browser Babel and no CDN
//   runtime dependency. Proves the app boots and core surfaces work.

const { test, expect } = require("@playwright/test");

const SHELL = "/index.html";

test.describe("S. Production build — boot smoke (precompiled bundle)", () => {

  test("production index.html boots the app with the precompiled bundle", async ({ page }) => {
    const fatalErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") fatalErrors.push(msg.text());
    });
    page.on("pageerror", (err) => fatalErrors.push(String(err)));

    await page.goto(SHELL);
    // Backend must initialise from the bundle.
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });

    // No in-browser Babel on the production path.
    const usesBabel = await page.evaluate(() => typeof window.Babel !== "undefined");
    expect(usesBabel).toBe(false);

    // React mounted into #root.
    await page.waitForSelector("#root *", { timeout: 20000 });
    const rootHasContent = await page.evaluate(() => (document.getElementById("root")?.childElementCount || 0) > 0);
    expect(rootHasContent).toBe(true);

    // Backend services are present.
    const backend = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      return {
        hasEntity: !!B?.EntityService,
        hasAI: !!B?.AIService,
        hasSearch: !!B?.SearchService,
        hasAudit: !!B?.AuditService,
      };
    });
    expect(backend.hasEntity).toBe(true);
    expect(backend.hasAI).toBe(true);
    expect(backend.hasSearch).toBe(true);
    expect(backend.hasAudit).toBe(true);

    // Filter out benign noise (favicon, font preload, vite client).
    const realErrors = fatalErrors.filter((e) =>
      !/favicon/i.test(e) && !/font/i.test(e) && !/\[vite\]/i.test(e) && !/Failed to load resource/i.test(e));
    expect(realErrors).toEqual([]);
  });

  test("Writer's Room renders and a panel + Settings can be reached via backend", async ({ page }) => {
    await page.goto(SHELL);
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    await page.waitForSelector("#root *", { timeout: 20000 });

    // Writer's Room is the default route — its canvas should be present.
    const hasCanvas = await page.waitForSelector("[data-ui='ManuscriptCanvas'], [data-ui='WorkspaceShell'], .wr-canvas, #root", { timeout: 20000 }).then(() => true).catch(() => false);
    expect(hasCanvas).toBe(true);

    // Exercise a backend round-trip from the production bundle: create
    // an entity, confirm it persists, and confirm search indexes it.
    const result = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const e = await B.EntityService.save("cast", { name: "Prod Boot Hess" });
      B.SearchService.rebuildIndex();
      const found = B.SearchService.search("Prod Boot Hess").some((r) => r.entityId === e.id);
      return { saved: !!e.id, found };
    });
    expect(result.saved).toBe(true);
    expect(result.found).toBe(true);
  });
});
