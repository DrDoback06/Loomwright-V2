// Workflow T51: Writer's Room Find & Replace. Counts matches, navigates with
// next/prev, replaces all, and Cmd/Ctrl+F opens the bar. Matches are painted
// via the CSS Custom Highlight API (no DOM mutation); replace edits text.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedAndOpenWR(page) {
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    const text = "The road to Vraska was long. Vraska held the pass.\n\nBeyond Vraska lay the open sea.";
    await B.ManuscriptChapterService.save({
      chapters: [{ id: "fr-1", num: 1, title: "One", state: "saved", bodyText: text }],
      activeChapterId: "fr-1",
      manuscripts: { "fr-1": { paragraphs: [
        { id: "fp-1", text: "The road to Vraska was long. Vraska held the pass." },
        { id: "fp-2", text: "Beyond Vraska lay the open sea." },
      ], text } },
      trashedChapters: [],
    });
    window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } }));
  });
  const body = page.locator("[data-testid='wr-manuscript-body']");
  await expect(body).toBeVisible({ timeout: 8000 });
  await expect(body.locator("p.wr-p")).toHaveCount(2, { timeout: 6000 });
  return body;
}

test.describe("T51. Writer's Room find & replace", () => {
  test("find counts + navigates matches, replace all swaps the text", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedAndOpenWR(page);
    await page.locator("[data-testid='wr-tb-find']").click();
    const input = page.locator("[data-testid='wr-find-input']");
    await expect(input).toBeVisible();
    await input.fill("Vraska");
    await expect(page.locator("[data-testid='wr-find-count']")).toHaveText("1/3");
    await page.locator("[data-testid='wr-find-next']").click();
    await expect(page.locator("[data-testid='wr-find-count']")).toHaveText("2/3");
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/wr-find.png" });
    await page.locator("[data-testid='wr-find-replace']").fill("Hollow");
    await page.locator("[data-testid='wr-find-replace-all']").click();
    await expect(page.locator("[data-testid='wr-find-count']")).toHaveText("0/0");
    await expect(body).toContainText("The road to Hollow was long.");
    await expect(body).not.toContainText("Vraska");
  });

  test("Cmd/Ctrl+F opens the find bar", async ({ page }) => {
    await openFreshApp(page);
    const body = await seedAndOpenWR(page);
    await body.click();
    await page.keyboard.press("Control+f");
    await expect(page.locator("[data-testid='wr-find-input']")).toBeVisible({ timeout: 4000 });
  });
});
