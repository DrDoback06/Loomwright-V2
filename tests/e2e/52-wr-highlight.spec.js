// Workflow T52: Writer's Room Highlight — a persistent inline mark. Selecting
// a passage and pressing Highlight wraps it; the mark is stored on the
// manuscript (keyed by paragraph + text) and survives Save + reload. Toggling
// removes it.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState } = require("./helpers");

async function seedAndOpenWR(page) {
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    const text = "The road to Vraska was long and cold.";
    await B.ManuscriptChapterService.save({
      chapters: [{ id: "hl-1", num: 1, title: "One", state: "saved", bodyText: text }],
      activeChapterId: "hl-1",
      manuscripts: { "hl-1": { paragraphs: [{ id: "hp-1", text }], text } },
      trashedChapters: [],
    });
    window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } }));
  });
  const body = page.locator("[data-testid='wr-manuscript-body']");
  await expect(body).toBeVisible({ timeout: 8000 });
  await expect(body.locator("p.wr-p")).toHaveCount(1, { timeout: 6000 });
  return body;
}
async function reopenWR(page) {
  await openAppPreserveState(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } })));
  const body = page.locator("[data-testid='wr-manuscript-body']");
  await expect(body).toBeVisible({ timeout: 8000 });
  return body;
}
async function selectWord(page, w) {
  await page.evaluate((word) => {
    const body = document.querySelector("[data-testid='wr-manuscript-body']");
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.nodeValue.indexOf(word);
      if (i >= 0) {
        const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + word.length);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); break;
      }
    }
  }, w);
}

test.describe("T52. Writer's Room highlight (persistent marks)", () => {
  test("highlight a passage; it survives Save + reload", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedAndOpenWR(page);
    await selectWord(page, "Vraska");
    await page.locator("[data-testid='wr-tb-highlight']").click();
    await expect(body.locator(".wr-mk--highlight")).toHaveText("Vraska", { timeout: 4000 });
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/wr-highlight.png" });
    await page.locator("[data-testid='wr-save']").click();
    await page.waitForTimeout(400);
    const body2 = await reopenWR(page);
    await expect(body2.locator(".wr-mk--highlight")).toHaveText("Vraska", { timeout: 6000 });
  });

  test("toggling highlight off removes it", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedAndOpenWR(page);
    await selectWord(page, "Vraska");
    await page.locator("[data-testid='wr-tb-highlight']").click();
    await expect(body.locator(".wr-mk--highlight")).toHaveCount(1);
    await selectWord(page, "Vraska");
    await page.locator("[data-testid='wr-tb-highlight']").click();
    await expect(body.locator(".wr-mk--highlight")).toHaveCount(0);
  });
});
