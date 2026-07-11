// Workflow T27: Area 8 — Writer's Room applies persisted workspace prefs.
//
// The onboarding / Settings → Workspace prefs (editorWidth / font / margins)
// were persisted but never read. The Writer's Room now drives the manuscript
// column width + font from them (via CSS vars) and hides margins when the pref
// is off — reacting live to a settings save.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.describe.configure({ timeout: 120_000 });

async function setWorkspacePref(page, patch) {
  await page.evaluate((p) => window.LoomwrightBackend.SettingsService.saveSection("workspace", p), patch);
  await page.waitForTimeout(300);
}

test.describe("T27. Writer's Room — workspace layout prefs", () => {
  test("editorWidth + font prefs drive the manuscript column", async ({ page }) => {
    await openFreshApp(page);
    const wr = page.locator("[data-ui='WritersRoomScreen']");
    await expect(wr).toBeVisible({ timeout: 8000 });

    await setWorkspacePref(page, { editorWidth: 900, font: "EB Garamond", margins: true });

    const vars = await wr.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { w: cs.getPropertyValue("--wr-editor-w").trim(), f: cs.getPropertyValue("--wr-editor-font").trim() };
    });
    // The pref drives the CSS vars the manuscript column reads
    // (--wr-editor-w / --wr-editor-font on the Writer's Room root).
    expect(vars.w).toBe("900px");
    expect(vars.f).toContain("EB Garamond");

    // Changing the pref updates the var live (no reload).
    await setWorkspacePref(page, { editorWidth: 620, font: "EB Garamond" });
    const w2 = await wr.evaluate((el) => getComputedStyle(el).getPropertyValue("--wr-editor-w").trim());
    expect(w2).toBe("620px");
  });

  test("margins:false hides the Writer's Room margins", async ({ page }) => {
    await openFreshApp(page);
    const wr = page.locator("[data-ui='WritersRoomScreen']");
    await expect(wr).toBeVisible({ timeout: 8000 });

    await setWorkspacePref(page, { margins: false });
    await expect(wr).toHaveAttribute("data-margins", "hidden");

    await setWorkspacePref(page, { margins: true });
    await expect(wr).toHaveAttribute("data-margins", "shown");
  });

  test("authorAttribution pref drives the attribution state", async ({ page }) => {
    await openFreshApp(page);
    const wr = page.locator("[data-ui='WritersRoomScreen']");
    await expect(wr).toBeVisible({ timeout: 8000 });

    await setWorkspacePref(page, { authorAttribution: false });
    await expect(wr).toHaveAttribute("data-attribution", "false");

    await setWorkspacePref(page, { authorAttribution: true });
    await expect(wr).toHaveAttribute("data-attribution", "true");
  });

  test("chapterRail:hidden hides the chapter strip", async ({ page }) => {
    await openFreshApp(page);
    const wr = page.locator("[data-ui='WritersRoomScreen']");
    await expect(wr).toBeVisible({ timeout: 8000 });

    const strip = page.locator("[data-ui='ChapterNodeStrip']");
    await setWorkspacePref(page, { chapterRail: "hidden" });
    await expect(wr).toHaveAttribute("data-chapter-rail", "hidden");
    await expect(strip).toBeHidden();

    await setWorkspacePref(page, { chapterRail: "left" });
    await expect(strip).toBeVisible();
  });

  test("focus pref starts the room in focus mode", async ({ page }) => {
    // Seed the pref BEFORE the room mounts (focus is applied once on mount).
    await openFreshApp(page);
    await page.evaluate(() => window.LoomwrightBackend.SettingsService.saveSection("workspace", { focus: true }));
    await page.reload();
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    const wr = page.locator("[data-ui='WritersRoomScreen']");
    await expect(wr).toBeVisible({ timeout: 8000 });
    await expect(wr).toHaveAttribute("data-focus", "true");
  });
});
