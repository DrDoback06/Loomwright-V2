// Workflow T68: Tangle tab (story board). The tab is already well-built +
// fully persistent (audit: every board/node/edge create/move/edit/delete
// goes through TangleService → KEYS.tangle). The gaps were no rename-board
// and no delete-board UI (methods existed but were never called). This
// verifies live notes render on the side panel + canvas AND the new inline
// board rename persists.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openTanglePanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "tangle" } })));
  await page.waitForTimeout(300);
}

test.describe("T68. Tangle tab", () => {
  test("live notes render + board rename persists + canvas shows the node", async ({ page }) => {
    await openFreshApp(page);
    await openTanglePanel(page);
    await expect(page.locator("[data-ui='TanglePanelBody']")).toBeVisible({ timeout: 5000 });

    // a board auto-creates (ensureBoard); add a live note via the service
    await page.evaluate(async () => {
      const TS = window.LoomwrightBackend.TangleService;
      await TS.ensureBoard();
      await TS.addNode({ kind: "note", title: "Salt-storm beat", preview: "the outer wall fell twice" });
    });
    await page.waitForTimeout(300);
    const side = page.locator("[data-ui='TanglePanelBody']");
    await expect(side).toContainText("Salt-storm beat"); // live node in recent notes
    await expect(side).toContainText("1 nodes");          // live count

    // rename the board inline -> persists via TangleService.renameBoard
    const nameInput = page.locator("[data-testid='tan-board-name']");
    await nameInput.fill("Act I beats");
    await nameInput.press("Enter");
    await page.waitForTimeout(250);
    const boardName = await page.evaluate(() => {
      const s = window.LoomwrightBackend.TangleService.loadSync();
      return (s.boards.find((b) => b.id === s.activeBoardId) || {}).name;
    });
    expect(boardName).toBe("Act I beats");

    // open the canvas -> the node renders there too
    await page.locator("[data-testid='tan-open-canvas']").click();
    await expect(page.locator("[data-ui='TangleFullScreen']")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("[data-ui='TangleNode']")).toContainText("Salt-storm beat");
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/tangle.png" });
  });
});
