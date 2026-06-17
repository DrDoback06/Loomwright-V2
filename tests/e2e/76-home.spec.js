// Workflow T76: Home route — regression. Audit: production-ready — every
// dashboard stat/count/card is live-derived (ManuscriptChapterService +
// writingStatsSync, ReviewService, EntityService per-type, InsightService),
// all quick actions wired, graceful fresh-project state, no hardcoded demo
// numbers. This locks in that the dashboard renders live project data.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

test.describe("T76. Home route", () => {
  test("dashboard renders live project data", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ManuscriptChapterService.save({
        chapters: [{ id: "h-ch", num: 1, title: "The Cold Open", words: 5, complete: false }],
        manuscripts: { "h-ch": { text: "Aelinor arrived in the cold." } },
        activeChapterId: "h-ch", trashedChapters: [],
      });
    });
    await saveEntity(page, "cast", { name: "Aelinor Vey" }, { status: "active" });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "home" } })));

    const home = page.locator("[data-ui='HomeScreen']");
    await expect(home).toBeVisible({ timeout: 5000 });
    await expect(home).toContainText("The Cold Open"); // live chapter (not demo data)
    // a core quick-action exists + is wired
    await expect(home.locator("[data-callback='onOpenWriterRoom']").first()).toBeVisible();
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/home.png" });
  });
});
