// Workflow T69: Speed Reader tab — regression. Audit: production-ready —
// reads LIVE manuscript prose (st.manuscripts[chapterId].text), RSVP engine
// + transport + WPM all work, settings persist per session via
// SpeedReaderService. This locks that in: a seeded chapter's real prose is
// tokenised and the transport steps through the live words.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openSpeedReaderPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "speedReader" } })));
  await page.waitForTimeout(300);
}

test.describe("T69. Speed Reader tab", () => {
  test("plays live manuscript prose with working transport", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ManuscriptChapterService.save({
        chapters: [{ id: "ch-test", num: 1, title: "Salt Test" }],
        manuscripts: { "ch-test": { text: "Brec met her at the stockade gate before dawn." } },
        activeChapterId: "ch-test",
        trashedChapters: [],
      });
    });
    await openSpeedReaderPanel(page);
    const panel = page.locator("[data-ui='SpeedReaderPanelBody']");
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel).toContainText("Salt Test");  // live chapter in the source picker

    const word = page.locator("[data-testid='sr-word']");
    await expect(word).toContainText("Brec");         // first word of LIVE prose (tokenised)
    await page.locator("[data-callback='onSpeedReaderNextWord']").click();
    await expect(word).toContainText("met");          // transport steps to the next live word
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/speedreader.png" });
  });
});
