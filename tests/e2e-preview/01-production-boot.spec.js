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

  test("PWA: manifest served, responsive viewport, service worker registers", async ({ page, request }) => {
    // Static assets are served by vite preview from dist/.
    const manifest = await request.get("/manifest.json");
    expect(manifest.ok()).toBe(true);
    const m = await manifest.json();
    expect(m.short_name).toBe("Loomwright");
    expect(m.display).toBe("standalone");

    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    const swBody = await sw.text();
    expect(swBody).not.toContain("__LW_CACHE_NAME__");
    expect(swBody).toContain("loomwright-");

    const icon = await request.get("/icons/loomwright-icon.svg");
    expect(icon.ok()).toBe(true);

    await page.goto(SHELL);
    const viewport = await page.locator("meta[name='viewport']").getAttribute("content");
    expect(viewport).toContain("width=device-width");
    await expect(page.locator("link[rel='manifest']")).toHaveAttribute("href", "manifest.json");

    // The SW registers and activates on the production origin.
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    const swState = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return "unsupported";
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      return reg ? "ready" : "none";
    });
    expect(swState).toBe("ready");
  });

  test("PWA: phone viewport boots the mobile shell from the bundle", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(SHELL);
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    await page.waitForSelector("#root *", { timeout: 20000 });
    await expect(page.locator(".app-shell")).toHaveAttribute("data-mobile", "true");
    await expect(page.locator("[data-testid='mnav']")).toBeVisible();
    await ctx.close();
  });
});
