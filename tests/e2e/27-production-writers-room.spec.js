// Workflow AA — Production Writer's Room structured editing.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedWriterProject(page) {
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    await B.ManuscriptChapterService.save({
      chapters: [
        { id: "aa-ch1", num: 1, title: "First Light", state: "saved", words: 11 },
        { id: "aa-ch2", num: 2, title: "Second Light", state: "saved", words: 5 },
        { id: "aa-ch3", num: 3, title: "Third Light", state: "saved", words: 5 },
      ],
      activeChapterId: "aa-ch1",
      manuscripts: {
        "aa-ch1": {
          paragraphs: [
            { id: "aa-p1", text: "Ash waited beside the old gate." },
            { id: "aa-p2", text: "Ash carried the lantern into winter." },
          ],
          text: "Ash waited beside the old gate.\n\nAsh carried the lantern into winter.",
          html: "<p class=\"wr-p\" data-paragraph-id=\"aa-p1\">Ash waited beside the old gate.</p><p class=\"wr-p\" data-paragraph-id=\"aa-p2\">Ash carried the lantern into winter.</p>",
          words: 12,
        },
        "aa-ch2": { paragraphs: [{ id: "aa-p3", text: "The road narrowed." }], text: "The road narrowed.", words: 3 },
        "aa-ch3": { paragraphs: [{ id: "aa-p4", text: "The bell answered." }], text: "The bell answered.", words: 3 },
      },
    });
    window.dispatchEvent(new CustomEvent("lw:manuscript-chapters-updated"));
    window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room", chapterId: "aa-ch1" } }));
    window.dispatchEvent(new CustomEvent("lw:set-active-chapter", { detail: { chapterId: "aa-ch1" } }));
  });
  const body = page.locator("[data-testid='wr-manuscript-body']");
  await expect(body).toBeVisible({ timeout: 10000 });
  await expect(page.locator("[data-ui='WriterProductionToolbar']")).toBeVisible({ timeout: 10000 });
  return body;
}

async function selectText(page, paragraphId, start, end) {
  await page.evaluate(({ paragraphId, start, end }) => {
    const paragraph = document.querySelector(`[data-paragraph-id="${paragraphId}"]`);
    if (!paragraph) throw new Error(`Paragraph not found: ${paragraphId}`);
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    if (!node) throw new Error("No text node found");
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, { paragraphId, start, end });
}

test.describe("AA. Production Writer's Room", () => {
  test("formats structured blocks, inserts scene breaks, and persists them through save/reload", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedWriterProject(page);

    await selectText(page, "aa-p1", 0, 3);
    await page.locator("[data-testid='wr-tb-heading']").click();
    await expect(body.locator("h2[data-block-type='heading'][data-paragraph-id='aa-p1']")).toBeVisible();

    await selectText(page, "aa-p2", 0, 3);
    await page.locator("[data-testid='wr-tb-quote']").click();
    await expect(body.locator("blockquote[data-block-type='quote'][data-paragraph-id='aa-p2']")).toBeVisible();

    await selectText(page, "aa-p2", 1, 4);
    await page.locator("[data-testid='wr-tb-scene-break']").click();
    await expect(body.locator("[data-kind='scene-break']")).toHaveCount(1);

    await page.locator("[data-testid='wr-save']").click();
    await page.waitForFunction(() => {
      const state = window.LoomwrightBackend?.ManuscriptChapterService?.loadSync?.();
      const html = state?.manuscripts?.["aa-ch1"]?.html || "";
      return html.includes("data-block-type=\"heading\"") && html.includes("data-kind=\"scene-break\"");
    });

    await page.reload();
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room", chapterId: "aa-ch1" } }));
      window.dispatchEvent(new CustomEvent("lw:set-active-chapter", { detail: { chapterId: "aa-ch1" } }));
    });
    const restored = page.locator("[data-testid='wr-manuscript-body']");
    await expect(restored.locator("h2[data-block-type='heading']")).toBeVisible({ timeout: 10000 });
    await expect(restored.locator("blockquote[data-block-type='quote']")).toBeVisible();
    await expect(restored.locator("[data-kind='scene-break']")).toBeVisible();
  });

  test("finds, replaces, and restores manuscript changes with structured undo/redo", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedWriterProject(page);

    await page.locator("[data-testid='wr-tb-find-replace']").click();
    const dialog = page.locator("[data-testid='wr-find-dialog']");
    await expect(dialog).toBeVisible();
    await dialog.locator("[data-testid='wr-find-query']").fill("Ash");
    await dialog.locator("[data-testid='wr-replace-value']").fill("Ember");
    await dialog.locator("[data-testid='wr-replace-all']").click();
    await expect(body).toContainText("Ember waited");
    await expect(body).toContainText("Ember carried");

    await page.locator("[data-testid='wr-tb-undo']").click();
    await expect(body).toContainText("Ash waited");
    await expect(body).toContainText("Ash carried");
    await page.locator("[data-testid='wr-tb-redo']").click();
    await expect(body).toContainText("Ember waited");
  });

  test("creates exact-range comments with stable offsets", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedWriterProject(page);

    await selectText(page, "aa-p1", 4, 10);
    await page.locator("[data-testid='wr-tb-range-comment']").click();
    const dialog = page.locator("[data-testid='wr-range-comment-dialog']");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("waited");
    await dialog.locator("[data-testid='wr-range-comment-text']").fill("Clarify why the character waits here.");
    await dialog.locator("[data-testid='wr-range-comment-save']").click();
    await expect(body.locator(".wr-range-comment")).toContainText("waited");

    const note = await page.evaluate(() => {
      const rows = window.LoomwrightBackend?.ManuscriptNoteService?.listByChapterSync?.("aa-ch1") || [];
      return rows.find((row) => row.source === "selection-range") || null;
    });
    expect(note).toBeTruthy();
    expect(note.paragraphId).toBe("aa-p1");
    expect(note.rangeStart).toBe(4);
    expect(note.rangeEnd).toBe(10);
    expect(note.quote).toBe("waited");
  });

  test("reorders chapters by drag and persists canonical numbering", async ({ page }) => {
    await openFreshApp(page);
    await seedWriterProject(page);

    const third = page.locator("[data-testid='wr-chapter-aa-ch3']");
    const first = page.locator("[data-testid='wr-chapter-aa-ch1']");
    await expect(third).toHaveAttribute("draggable", "true");
    await third.dragTo(first);
    await page.waitForFunction(() => {
      const rows = window.LoomwrightBackend?.ManuscriptChapterService?.loadSync?.()?.chapters || [];
      return rows.map((row) => row.id).join(",") === "aa-ch3,aa-ch1,aa-ch2";
    });
    const order = await page.evaluate(() => window.LoomwrightBackend.ManuscriptChapterService.loadSync().chapters.map((row) => ({ id: row.id, num: row.num })));
    expect(order).toEqual([
      { id: "aa-ch3", num: 1 },
      { id: "aa-ch1", num: 2 },
      { id: "aa-ch2", num: 3 },
    ]);
  });
});
