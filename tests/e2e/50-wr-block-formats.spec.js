// Workflow T50: Writer's Room block formats — Heading, Scene break, Quote.
// These were disabled toolbar buttons; they now format the current paragraph
// (Heading/Quote) or insert a divider (Scene break), and the block kind
// survives Save + reload via the paragraph model.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState } = require("./helpers");

async function seedChapterAndOpenWR(page) {
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    await B.ManuscriptChapterService.save({
      chapters: [{ id: "wc-1", num: 1, title: "One", state: "saved", bodyText: "The first line of the chapter." }],
      activeChapterId: "wc-1",
      manuscripts: { "wc-1": { paragraphs: [
        { id: "wp-1", text: "The first line of the chapter." },
        { id: "wp-2", text: "A second paragraph follows after it." },
      ], text: "The first line of the chapter.\n\nA second paragraph follows after it." } },
      trashedChapters: [],
    });
    window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } }));
  });
  const body = page.locator("[data-testid='wr-manuscript-body']");
  await expect(body).toBeVisible({ timeout: 8000 });
  await expect(body.locator("p.wr-p")).toHaveCount(2, { timeout: 6000 });
  return body;
}

async function reopenWR(page) {
  await openAppPreserveState(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } })));
  const body = page.locator("[data-testid='wr-manuscript-body']");
  await expect(body).toBeVisible({ timeout: 8000 });
  return body;
}

test.describe("T50. Writer's Room block formats", () => {
  test("Heading formats the current paragraph and persists across reload", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedChapterAndOpenWR(page);
    await body.locator("p.wr-p").first().click();
    await page.locator("[data-testid='wr-tb-heading']").click();
    await expect(body.locator("h2")).toHaveCount(1);
    await page.locator("[data-testid='wr-save']").click();
    await page.waitForTimeout(400);
    const body2 = await reopenWR(page);
    await expect(body2.locator("h2.wr-h")).toHaveCount(1, { timeout: 6000 });
  });

  test("Scene break inserts a divider", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedChapterAndOpenWR(page);
    const before = await body.locator(".wr-scene-break").count();
    await body.locator("p.wr-p").first().click();
    await page.locator("[data-testid='wr-tb-scenebreak']").click();
    await expect(body.locator(".wr-scene-break")).toHaveCount(before + 1);
  });

  test("Heading and Quote render together", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedChapterAndOpenWR(page);
    await body.locator("p.wr-p").first().click();
    await page.locator("[data-testid='wr-tb-heading']").click();
    await expect(body.locator("h2")).toHaveCount(1);
    // p1 is now an <h2>, so the remaining wr-p is the second paragraph.
    await body.locator("p.wr-p").first().click();
    await page.locator("[data-testid='wr-tb-quote']").click();
    await expect(body.locator("blockquote")).toHaveCount(1);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/wr-blocks.png" });
  });
});
