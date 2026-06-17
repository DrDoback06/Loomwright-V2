// Workflow T53: Writer's Room Insert reference + Insert footnote — both ride
// the persistent inline-marks model. Reference links the selection to a
// matching entity (double-click opens it); footnote wraps the selection with a
// note edited in a popover. Both survive Save + reload.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity } = require("./helpers");

async function seedAndOpenWR(page, text) {
  await page.evaluate(async (t) => {
    const B = window.LoomwrightBackend;
    await B.ManuscriptChapterService.save({
      chapters: [{ id: "mk-1", num: 1, title: "One", state: "saved", bodyText: t }],
      activeChapterId: "mk-1",
      manuscripts: { "mk-1": { paragraphs: [{ id: "mp-1", text: t }], text: t } },
      trashedChapters: [],
    });
    window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } }));
  }, text);
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

test.describe("T53. Writer's Room reference + footnote marks", () => {
  test("Insert reference links the selection to a matching entity and persists", async ({ page }) => {
    await openFreshApp(page);
    const loc = await saveEntity(page, "locations", { name: "Vraska Pass" }, { status: "active" });
    const body = await seedAndOpenWR(page, "They crossed Vraska Pass at dawn.");
    await selectText(page, "Vraska Pass");
    await page.locator("[data-testid='wr-tb-reference']").click();
    const ref = body.locator(".wr-mk--reference");
    await expect(ref).toContainText("Vraska Pass", { timeout: 4000 });
    await expect(ref).toHaveAttribute("data-ref-id", loc.id);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/wr-ref.png" });
    await page.locator("[data-testid='wr-save']").click();
    await page.waitForTimeout(400);
    const body2 = await reopenWR(page);
    await expect(body2.locator(".wr-mk--reference")).toContainText("Vraska Pass", { timeout: 6000 });
  });

  test("Insert footnote wraps the selection; the note saves and persists", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedAndOpenWR(page, "The bell rang at midnight.");
    await selectText(page, "bell");
    await page.locator("[data-testid='wr-tb-footnote']").click();
    await expect(body.locator(".wr-mk--footnote")).toContainText("bell", { timeout: 4000 });
    const note = page.locator("[data-testid='wr-fn-note']");
    await expect(note).toBeVisible();
    await note.fill("A cathedral bell, tolling the hour.");
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/wr-footnote.png" });
    await page.locator("[data-testid='wr-fn-save']").click();
    await expect(body.locator(".wr-mk--footnote")).toHaveAttribute("data-note", "A cathedral bell, tolling the hour.");
    await page.locator("[data-testid='wr-save']").click();
    await page.waitForTimeout(400);
    const body2 = await reopenWR(page);
    await expect(body2.locator(".wr-mk--footnote")).toHaveAttribute("data-note", "A cathedral bell, tolling the hour.", { timeout: 6000 });
  });
});
