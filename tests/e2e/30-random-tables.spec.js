// Workflow U30: Phase 11 — Random Tables panel (Alkemion-inspired
// generators). Starter tables roll real weighted results; user tables
// are editable and persist; results feed the Writer's Room and the
// entity editor.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState } = require("./helpers");

async function openTables(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "randomTables" } }));
  });
  await page.waitForTimeout(300);
}

test.describe("U30. Random Tables — generators", () => {
  test("starter tables list, roll results, and log history", async ({ page }) => {
    await openFreshApp(page);
    await openTables(page);
    const rt = page.locator("[data-ui='RandomTablesPanelBody']");
    await expect(rt).toBeVisible();
    await expect(rt.locator(".rt__row", { hasText: "Plot twists" })).toBeVisible();
    await rt.locator(".rt__row", { hasText: "Plot twists" }).click();
    await rt.locator("[data-testid='rt-roll']").click();
    await page.waitForTimeout(300);
    await expect(rt.locator(".rt__result")).toHaveCount(1);
    await expect(rt).toContainText("Recent rolls");
    const hist = await page.evaluate(() => window.LoomwrightBackend.RandomTableService.historySync().length);
    expect(hist).toBe(1);
  });

  test("user table: create, edit rows, roll without repeats, persist reload", async ({ page }) => {
    await openFreshApp(page);
    await openTables(page);
    const rt = page.locator("[data-ui='RandomTablesPanelBody']");
    await rt.locator("[data-testid='rt-new-table']").click();
    await page.waitForTimeout(300);
    // Row editor opens for the new table; rename a row.
    await expect(rt.locator("[data-ui='RtRowEditor']")).toBeVisible();
    const firstRow = rt.locator(".rt__rowedit-text").first();
    await firstRow.fill("The miller pays in foreign coin.");
    await firstRow.blur();
    await page.waitForTimeout(300);
    // Add a third row.
    await rt.locator("[data-testid='rt-add-row']").click();
    await page.waitForTimeout(200);
    const rows = await page.evaluate(() => {
      const t = window.LoomwrightBackend.RandomTableService.loadSync().tables[0];
      return t.rows.length;
    });
    expect(rows).toBe(3);
    // Roll 3 unique — all distinct.
    await rt.locator("[data-testid='rt-edit-toggle']").click(); // done editing
    await rt.locator(".rt__rollbar select").selectOption("3");
    await rt.locator("[data-testid='rt-roll']").click();
    await page.waitForTimeout(300);
    const texts = await rt.locator(".rt__result-text").allTextContents();
    expect(new Set(texts).size).toBe(texts.length);
    // Survives reload.
    await openAppPreserveState(page);
    const after = await page.evaluate(() => window.LoomwrightBackend.RandomTableService.loadSync().tables.length);
    expect(after).toBe(1);
  });

  test("results feed the Writer's Room and spin into entities", async ({ page }) => {
    await openFreshApp(page);
    // A chapter to receive the inserted text.
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.ManuscriptChapterService.save({
        chapters: [{ id: "u30-c1", num: 1, title: "One" }],
        activeChapterId: "u30-c1",
        manuscripts: { "u30-c1": { html: "", text: "" } },
      });
    });
    await openTables(page);
    const rt = page.locator("[data-ui='RandomTablesPanelBody']");
    await rt.locator(".rt__row", { hasText: "Character names" }).click();
    await rt.locator("[data-testid='rt-roll']").click();
    await page.waitForTimeout(300);
    const rolled = (await rt.locator(".rt__result-text").first().textContent()).trim();
    // → Writer inserts into the active chapter.
    await rt.locator(".rt__result button", { hasText: "→ Writer" }).click();
    await page.waitForTimeout(400);
    const chapterText = await page.evaluate(() =>
      window.LoomwrightBackend.ManuscriptChapterService.loadSync().manuscripts["u30-c1"].text);
    expect(chapterText).toContain(rolled);
    // Create entity opens the editor prefilled (names table → cast).
    await rt.locator("[data-testid='rt-create-entity-0']").click();
    await page.waitForTimeout(400);
    const editor = page.locator("[data-ui='EntityEditor'], .ee-host, .entity-editor").first();
    await expect(editor).toBeVisible();
    await expect(editor).toContainText(rolled);
  });

  test("duplicating a starter creates an editable copy; the starter stays", async ({ page }) => {
    await openFreshApp(page);
    await openTables(page);
    const rt = page.locator("[data-ui='RandomTablesPanelBody']");
    await rt.locator(".rt__row", { hasText: "Weather" }).click();
    await rt.locator("[data-testid='rt-duplicate']").click();
    await page.waitForTimeout(300);
    await expect(rt.locator(".rt__row", { hasText: "Weather (copy)" })).toBeVisible();
    await expect(rt.locator(".rt__row", { hasText: /^Weather/ })).toHaveCount(2);
    await expect(rt.locator("[data-ui='RtRowEditor']")).toBeVisible();
  });
});
