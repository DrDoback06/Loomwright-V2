// Workflow T54: Writer's Room Thesaurus — select a word, see offline synonyms,
// click one to replace it in place (preserving leading capitalisation).

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedAndOpenWR(page, text) {
  await page.evaluate(async (t) => {
    const B = window.LoomwrightBackend;
    await B.ManuscriptChapterService.save({
      chapters: [{ id: "th-1", num: 1, title: "One", state: "saved", bodyText: t }],
      activeChapterId: "th-1",
      manuscripts: { "th-1": { paragraphs: [{ id: "tp-1", text: t }], text: t } },
      trashedChapters: [],
    });
    window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } }));
  }, text);
  const body = page.locator("[data-testid='wr-manuscript-body']");
  await expect(body).toBeVisible({ timeout: 8000 });
  await expect(body.locator("p.wr-p")).toHaveCount(1, { timeout: 6000 });
  return body;
}
async function selectText(page, t) {
  await page.evaluate((needle) => {
    const body = document.querySelector("[data-testid='wr-manuscript-body']");
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.nodeValue.indexOf(needle);
      if (i >= 0) { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + needle.length); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); break; }
    }
  }, t);
}

test.describe("T54. Writer's Room thesaurus", () => {
  test("synonyms appear and replace the selected word in place", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedAndOpenWR(page, "It was a big and cold night.");
    await selectText(page, "big");
    await page.locator("[data-testid='wr-tb-thesaurus']").click();
    await expect(page.locator("[data-ui='ThesaurusPopover']")).toBeVisible({ timeout: 4000 });
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/wr-thes.png" });
    await page.locator("[data-testid='wr-thes-syn']", { hasText: "large" }).click();
    await expect(body).toContainText("It was a large and cold night.");
    await expect(body).not.toContainText("big");
  });
});
