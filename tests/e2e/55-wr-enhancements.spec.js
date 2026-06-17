// Workflow T55: Writer's Room author enhancements — per-chapter word-count
// goal with progress, typewriter mode, and debounced autosave.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedAndOpenWR(page, text) {
  await page.evaluate(async (t) => {
    const B = window.LoomwrightBackend;
    await B.ManuscriptChapterService.save({
      chapters: [{ id: "ec-1", num: 1, title: "One", state: "saved", bodyText: t, words: 50 }],
      activeChapterId: "ec-1",
      manuscripts: { "ec-1": { paragraphs: [{ id: "ep-1", text: t }], text: t } },
      trashedChapters: [],
    });
    window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } }));
  }, text);
  const body = page.locator("[data-testid='wr-manuscript-body']");
  await expect(body).toBeVisible({ timeout: 8000 });
  await expect(body.locator("p.wr-p")).toHaveCount(1, { timeout: 6000 });
  return body;
}

test.describe("T55. Writer's Room enhancements", () => {
  test("word-count goal shows progress", async ({ page }) => {
    await openFreshApp(page);
    await seedAndOpenWR(page, "Some words here in the chapter body text.");
    await page.locator("[data-testid='wr-goal-input']").fill("100");
    await expect(page.locator("[data-testid='wr-stats-words']")).toContainText("/ 100");
    await expect(page.locator("[data-testid='wr-stats-words']")).toContainText("50%");
    await expect(page.locator("[data-testid='wr-stats-fill']")).toBeVisible();
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/wr-stats.png" });
  });

  test("typewriter toggle sets the mode", async ({ page }) => {
    await openFreshApp(page);
    await seedAndOpenWR(page, "Line one.");
    await expect(page.locator("[data-typewriter='false']")).toHaveCount(1);
    await page.locator("[data-testid='wr-typewriter']").click();
    await expect(page.locator("[data-typewriter='true']")).toHaveCount(1);
  });

  test("autosave persists edits after a pause", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedAndOpenWR(page, "Start here. ");
    await body.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("AUTOSAVED");
    await page.waitForTimeout(2700);
    const text = await page.evaluate(() => window.LoomwrightBackend.ManuscriptChapterService.loadSync().manuscripts["ec-1"].text);
    expect(text).toContain("AUTOSAVED");
  });
});
