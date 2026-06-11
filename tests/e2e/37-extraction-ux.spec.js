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

    // The progress modal drove itself from live engine events: it shows a
    // snapshot of what was found and flips to complete with a real count.
    const modal = page.locator("[data-ui='ExtractionProgressModal']");
    await expect(modal).toHaveAttribute("data-state", "complete");
    const foundNames = await modal.locator("[data-testid='exm-found-name']").allTextContents();
    expect(foundNames).toContain("Brec Tollman");
    expect(foundNames).toContain("Anwen Hale");
    await expect(modal).toContainText("New candidates");
    // Review button routes to the live Review panel.
    await modal.locator("[data-testid='extraction-review']").dispatchEvent("click");
    await expect(page.locator("[data-panel-id='p-review']")).toBeVisible();
    await expect(page.locator("[data-panel-id='p-review']")).toContainText("Brec Tollman");
  });

  test("re-confirmed known entities are labelled, never mistaken for new finds", async ({ page }) => {
    await openFreshApp(page);
    // "Anwen Hale" already accepted into the world; the text mentions her
    // repeatedly but contains exactly one NEW name.
    await saveEntity(page, "cast", { name: "Anwen Hale", data: { pronouns: "she/her" } });
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ManuscriptChapterService.createFromComposition({ title: "Known" });
    });
    await page.reload();
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    await pasteIntoChapter(page,
      "Anwen Hale waited at the gate. Anwen Hale counted the lamps twice. She did not trust the dark. " +
      "The gatekeeper, an old man named Brec Tollman, watched Anwen Hale from his post. Brec Tollman said nothing.");
    await page.locator("[data-testid='wr-extract-chapter']").dispatchEvent("click");

    const modal = page.locator("[data-ui='ExtractionProgressModal']");
    await expect(modal).toHaveAttribute("data-state", "complete", { timeout: 20000 });
    // Known mentions live in their own labelled section with per-entity counts…
    const knownChip = modal.locator("[data-testid='exm-known-chip']", { hasText: "Anwen Hale" });
    await expect(knownChip).toBeVisible();
    await expect(knownChip).toContainText("×");
    await expect(modal.locator("[data-testid='exm-known']")).toContainText("Already in your world");
    // …and the NEW column's names never include the known entity (her name
    // may appear inside another row's source quote, so check names only).
    const newNames = await modal.locator("[data-testid='exm-found-name']").allTextContents();
    expect(newNames).toContain("Brec Tollman");
    expect(newNames.filter((n) => n === "Anwen Hale")).toHaveLength(0);
    // The footer states the split in words.
    await expect(modal).toContainText("re-confirmed");
    // The queue holds only the new candidate — known mentions never enter it.
    const queueNames = await page.evaluate(() =>
      window.LoomwrightBackend.ReviewService.listSync().map((q) => q.name));
    expect(queueNames).toContain("Brec Tollman");
    expect(queueNames).not.toContain("Anwen Hale");
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
