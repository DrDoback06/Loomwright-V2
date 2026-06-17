// Workflow T75: Writer's Room. Audit: SOLID — core persistence airtight
// (typing+Save, chapter ops, notes, Save & Extract all persist; graceful
// offline extraction; live entity highlighting). The real gap: programmatic
// edits (Find/Replace, highlight/footnote marks) marked "unsaved" but did
// NOT schedule autosave like typing does, so a relied-on autosave could miss
// them. Fixed by routing those handlers through onManuscriptChange. This
// verifies a replace-all autosave-persists WITHOUT an explicit Save.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.describe("T75. Writer's Room", () => {
  test("find/replace edits autosave-persist without an explicit Save", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ManuscriptChapterService.save({
        chapters: [{ id: "wr-ch", num: 1, title: "Salt Test" }],
        manuscripts: { "wr-ch": { text: "The auger was lit before dawn.", html: "<p>The auger was lit before dawn.</p>" } },
        activeChapterId: "wr-ch", trashedChapters: [],
      });
    });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } })));
    await expect(page.locator("[data-ui='ManuscriptCanvas']")).toBeVisible({ timeout: 5000 });

    // focus the editor (Ctrl+F only opens find when the event target is inside .wr)
    await page.getByText("The auger was lit before dawn.").click();
    // open find/replace (Ctrl+F) and replace every "auger" -> "augur"
    await page.keyboard.press("Control+f");
    await expect(page.locator("[data-ui='FindReplaceBar']")).toBeVisible({ timeout: 5000 });
    await page.locator("[data-testid='wr-find-input']").fill("auger");
    await expect(page.locator("[data-testid='wr-find-count']")).not.toHaveText("0/0", { timeout: 3000 });
    await page.locator("[data-testid='wr-find-replace']").fill("augur");
    await page.locator("[data-testid='wr-find-replace-all']").click();

    // autosave (2s debounce) persists the replacement — no Save click
    await page.waitForTimeout(2800);
    const persisted = await page.evaluate(() => window.LoomwrightBackend.ManuscriptChapterService.loadSync().manuscripts["wr-ch"].text);
    expect(persisted).toContain("augur");
    expect(persisted).not.toContain("auger");
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/writersroom.png" });
  });
});
