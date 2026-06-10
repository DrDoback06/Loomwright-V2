// Workflow U31: Phase 12 — Markdown/HTML world-bible export from the
// Control Centre, with scope checkboxes (manuscript / codex).

const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const { openFreshApp } = require("./helpers");

async function openControlCentre(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
      detail: { workspaceId: "control-centre", panelKind: "settings", sourcePanel: "p-settings" },
    }));
  });
  await page.waitForTimeout(400);
  // The export buttons live in the "Import / export" section.
  await page.locator("button", { hasText: "Import / export" }).first().click();
  await page.waitForTimeout(300);
}

test.describe("U31. World bible export — Markdown / HTML", () => {
  test("Export as Markdown downloads the live project as prose", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.EntityService.save("cast", { name: "Anwen Hale", summary: "Holds the north road." }, { status: "active" });
      await B.ManuscriptChapterService.save({
        chapters: [{ id: "u31-c1", num: 1, title: "The Gate" }],
        activeChapterId: "u31-c1",
        manuscripts: { "u31-c1": { html: "", text: "Anwen walked the toll road in the rain." } },
      });
    });
    await openControlCentre(page);
    const btn = page.locator("[data-testid='set-export-md']");
    await expect(btn).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      btn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/loomwright-world-bible-.*\.md$/);
    const text = fs.readFileSync(await download.path(), "utf8");
    expect(text).toContain("# Loomwright Project");
    expect(text).toContain("### Anwen Hale");
    expect(text).toContain("toll road in the rain");
  });

  test("HTML export honours the scope checkboxes", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.EntityService.save("cast", { name: "Anwen Hale" }, { status: "active" });
      await B.ManuscriptChapterService.save({
        chapters: [{ id: "u31-c2", num: 1, title: "The Gate" }],
        activeChapterId: "u31-c2",
        manuscripts: { "u31-c2": { html: "", text: "Words that must NOT export." } },
      });
    });
    await openControlCentre(page);
    // Untick "Manuscript" — codex only.
    await page.locator("[data-ui='SetExportScope'] label", { hasText: "Manuscript" }).locator("input").uncheck();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("[data-testid='set-export-html']").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.html$/);
    const html = fs.readFileSync(await download.path(), "utf8");
    expect(html).toContain("<h3>Anwen Hale</h3>");
    expect(html).not.toContain("Words that must NOT export.");
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });
});
