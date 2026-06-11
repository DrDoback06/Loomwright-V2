// Workflow U37: Extraction UX — the "pasted text but can't extract /
// nothing appears" bugs from manual testing.
//
// 1. A permanent Extract button lives in the Writer's Room canvasbar
//    and runs chapter extraction end-to-end.
// 2. Sentence-initial multi-word names are discovered (the protagonist
//    usually OPENS sentences).
// 3. When the confidence threshold filters every candidate, extraction
//    says so instead of finishing silently.
// 4. A stored threshold of 80 (the old Settings default that silently
//    broke local extraction) migrates back to the engine default.
// 5. The selection toolbar's Extract / New entity / Link actions work.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

const PROSE = `Anwen Hale crossed the toll bridge at dusk, her satchel heavy with foreign coin. The gatekeeper, an old man named Brec Tollman, watched her from his post. Brec Tollman had kept the bridge for thirty winters.

"You're late," Brec said. Anwen Hale did not answer. She paid the toll and walked on toward Greywater Keep, where the Iron Seal waited in its vault. The Iron Seal had been her family's burden for three generations.

At Greywater Keep the lamps were already lit. Anwen handed the Iron Seal to the castellan and felt nothing at all.`;

// Type prose into the live contenteditable the way a paste lands.
async function pasteIntoChapter(page, text) {
  await page.evaluate((t) => {
    const body = document.querySelector("[data-testid='wr-manuscript-body']");
    body.innerHTML = t.split(/\n{2,}/).map((p) =>
      `<p class="wr-p" data-paragraph-id="p-${Math.random().toString(36).slice(2, 8)}">${p}</p>`).join("");
    body.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
}

test.describe("U37. Extraction UX", () => {
  test("canvasbar Extract button runs chapter extraction end-to-end", async ({ page }) => {
    await openFreshApp(page);
    // Writer's Room is the default route; create a chapter to write into.
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ManuscriptChapterService.createFromComposition({ title: "The Toll" });
    });
    await page.reload();
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    await expect(page.locator("[data-testid='wr-manuscript-body']")).toBeVisible();
    await pasteIntoChapter(page, PROSE);

    const extract = page.locator("[data-testid='wr-extract-chapter']");
    await expect(extract).toBeVisible();
    // The floating panel dock can overlap the canvasbar's right side at
    // this viewport (same as Save) — dispatch the click directly.
    await extract.dispatchEvent("click");
    // The progress modal walks its stages; wait for candidates to land.
    await page.waitForFunction(() =>
      (window.LoomwrightBackend.ReviewService.listSync() || []).length >= 3, null, { timeout: 20000 });
    const names = await page.evaluate(() =>
      window.LoomwrightBackend.ReviewService.listSync().map((q) => q.name));
    expect(names).toContain("Brec Tollman");
    expect(names).toContain("Anwen Hale"); // sentence-initial multi-word name
    expect(names).toContain("Greywater Keep");
  });

  test("threshold that filters everything produces a notice, not silence", async ({ page }) => {
    await openFreshApp(page);
    const notices = await page.evaluate(async (text) => {
      const out = [];
      window.addEventListener("lw:backend-notice", (e) => out.push(e.detail?.message || ""));
      const B = window.LoomwrightBackend;
      await B.SettingsService.saveSection("extraction", { threshold: 95, _thresholdMigrated: true });
      await B.ManuscriptChapterService.save({
        chapters: [{ id: "u37-c1", num: 1, title: "T" }],
        activeChapterId: "u37-c1",
        manuscripts: { "u37-c1": { html: "", text } },
      });
      await B.ExtractionService.runExtraction({ chapterId: "u37-c1", text, deep: false });
      return { out, queue: B.ReviewService.listSync().length };
    }, PROSE);
    expect(notices.queue).toBe(0);
    expect(notices.out.some((m) => /below your 95% confidence threshold/i.test(m))).toBe(true);
  });

  test("legacy threshold 80 migrates to the engine default on boot", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.SettingsService.saveSection("extraction", { threshold: 80 });
    });
    await page.reload();
    await page.waitForFunction(() => window.__LW_BACKEND_DELEGATES__ === true, null, { timeout: 15000 }).catch(() => {});
    const after = await page.evaluate(() =>
      window.LoomwrightBackend.SettingsService.getSectionSync("extraction", {}));
    expect(after.threshold).toBe(50);
    expect(after._thresholdMigrated).toBe(true);
  });

  test("selection toolbar: Extract opens the wizard scoped to the selection", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ManuscriptChapterService.createFromComposition({ title: "Sel" });
    });
    await page.reload();
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    await pasteIntoChapter(page, PROSE);
    // Select the first paragraph programmatically (selectionchange drives the toolbar).
    await page.evaluate(() => {
      const p = document.querySelector("[data-testid='wr-manuscript-body'] p");
      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    const fst = page.locator("[data-ui='FloatingSelectionToolbar']");
    await expect(fst).toBeVisible();
    await page.locator("[data-testid='wr-fst-extract']").click();
    await expect(page.locator("[data-ui='ExtractionWizard']")).toBeVisible();
    const seeded = await page.evaluate(() => window.__LW_WIZARD_SELECTION__?.text || "");
    expect(seeded).toContain("Anwen Hale crossed the toll bridge");
  });
});
